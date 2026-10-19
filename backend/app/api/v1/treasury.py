from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Cliente, CuentaPorCobrar, CuentaPorPagar, Moneda, MovimientoCaja, Proveedor
from app.schemas.operations import CajaIn, PagoIn
from app.security.rbac import require_permission
from app.services import audit_service, treasury_service as svc
from app.services.pricing import D

router = APIRouter(prefix="/treasury", tags=["Tesorería / Finanzas"])


def _row_cxc(c):
    return dict(id=c.id, cliente=c.cliente.razon_social, documento=c.cliente.documento, referencia=c.venta.numero_ov,
                comprobante=f"{c.venta.serie_comprobante}-{c.venta.numero_comprobante}" if c.venta.numero_comprobante else None,
                moneda=c.venta.moneda.codigo, monto_original=c.monto_original, saldo=c.saldo,
                vencimiento=c.vencimiento, estado=c.estado,
                vencida=c.estado in ("PENDIENTE", "PARCIAL") and c.vencimiento < date.today())


def _row_cxp(c):
    return dict(id=c.id, proveedor=c.proveedor.razon_social, ruc=c.proveedor.ruc, referencia=c.compra.numero_oc,
                comprobante=f"{c.compra.serie_comprobante}-{c.compra.numero_comprobante}" if c.compra.numero_comprobante else None,
                moneda=c.compra.moneda.codigo, monto_original=c.monto_original, saldo=c.saldo,
                vencimiento=c.vencimiento, estado=c.estado,
                vencida=c.estado in ("PENDIENTE", "PARCIAL") and c.vencimiento < date.today())


@router.get("/cxc")
def list_cxc(estado: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "read"))):
    stmt = select(CuentaPorCobrar)
    if estado:
        stmt = stmt.where(CuentaPorCobrar.estado == estado)
    return {"items": [_row_cxc(c) for c in db.scalars(stmt.order_by(CuentaPorCobrar.vencimiento).limit(500))]}


@router.get("/cxp")
def list_cxp(estado: Optional[str] = None, db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "read"))):
    stmt = select(CuentaPorPagar)
    if estado:
        stmt = stmt.where(CuentaPorPagar.estado == estado)
    return {"items": [_row_cxp(c) for c in db.scalars(stmt.order_by(CuentaPorPagar.vencimiento).limit(500))]}


def _pay(kind, model, cid, body: PagoIn, db, user):
    cuenta = db.execute(select(model).where(model.id == cid).with_for_update()).scalar_one_or_none()
    if not cuenta:
        raise HTTPException(404, "Cuenta no encontrada")
    try:
        svc.registrar_pago(db, user, cuenta, kind, body.monto, body.forma_pago_id, body.concepto)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    return _row_cxc(cuenta) if kind == "cxc" else _row_cxp(cuenta)


@router.post("/cxc/{cid}/cobrar")
def cobrar(cid: int, body: PagoIn, db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "update"))):
    return _pay("cxc", CuentaPorCobrar, cid, body, db, user)


@router.post("/cxp/{cid}/pagar")
def pagar(cid: int, body: PagoIn, db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "update"))):
    return _pay("cxp", CuentaPorPagar, cid, body, db, user)


@router.get("/caja")
def list_caja(limit: int = 200, db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "read"))):
    rows = db.scalars(select(MovimientoCaja).order_by(MovimientoCaja.id.desc()).limit(limit)).all()
    return {"items": [dict(id=m.id, fecha=m.fecha, tipo=m.tipo, monto=m.monto, moneda=m.moneda.codigo,
                           concepto=m.concepto, cxc_id=m.cxc_id, cxp_id=m.cxp_id) for m in rows]}


@router.get("/caja/resumen")
def caja_resumen(db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "read"))):
    rows = db.execute(select(Moneda.codigo, MovimientoCaja.tipo, func.sum(MovimientoCaja.monto))
                      .join(Moneda, Moneda.id == MovimientoCaja.moneda_id)
                      .group_by(Moneda.codigo, MovimientoCaja.tipo)).all()
    res: dict = {}
    for cod, tipo, tot in rows:
        r = res.setdefault(cod, dict(moneda=cod, ingresos=D(0), egresos=D(0)))
        r["ingresos" if tipo == "INGRESO" else "egresos"] = D(tot)
    for r in res.values():
        r["saldo"] = r["ingresos"] - r["egresos"]
    return list(res.values())


@router.post("/caja", status_code=201)
def create_caja(body: CajaIn, db: Session = Depends(get_db), user=Depends(require_permission("tesoreria", "create"))):
    if not db.get(Moneda, body.moneda_id):
        raise HTTPException(422, "Moneda no encontrada")
    m = MovimientoCaja(tipo=body.tipo, monto=D(body.monto), moneda_id=body.moneda_id,
                       forma_pago_id=body.forma_pago_id, concepto=body.concepto, usuario_id=user.id)
    db.add(m)
    db.flush()
    audit_service.log(db, user.id, "INSERT", "tesoreria", f"caja:{m.id}", detalle={"tipo": body.tipo, "monto": body.monto})
    db.commit()
    return {"id": m.id}
