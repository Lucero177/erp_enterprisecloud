from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Cliente, Cotizacion, CuentaPorCobrar, Venta
from app.schemas.operations import AnularIn, ConvertirIn, CotizacionCreate, FacturarIn, OrdenCreate
from app.security.rbac import require_permission
from app.services import audit_service, sales_service as svc
from app.services.pricing import D

router = APIRouter(prefix="/sales", tags=["Ventas"])


def _tx(db, user, fn, modulo_registro: str):
    """Ejecuta una operación de servicio con commit/rollback y auditoría de fallo."""
    try:
        res = fn()
        db.commit()
        return res
    except HTTPException as e:
        db.rollback()
        audit_service.log_isolated(user.id, "ERROR", "ventas", modulo_registro, "FALLO", {"error": e.detail})
        raise
    except Exception:
        db.rollback()
        audit_service.log_isolated(user.id, "ERROR", "ventas", modulo_registro, "FALLO")
        raise


# ---- Cotizaciones
@router.get("/cotizaciones")
def list_cotizaciones(q: Optional[str] = None, estado: Optional[str] = None, db: Session = Depends(get_db),
                      user=Depends(require_permission("ventas", "read"))):
    stmt = select(Cotizacion).join(Cliente)
    if q:
        stmt = stmt.where(or_(Cotizacion.numero.ilike(f"%{q}%"), Cliente.razon_social.ilike(f"%{q}%")))
    if estado:
        stmt = stmt.where(Cotizacion.estado == estado)
    return {"items": [svc.cotizacion_out(c, False) for c in db.scalars(stmt.order_by(Cotizacion.id.desc()).limit(300))]}


@router.get("/cotizaciones/{cid}")
def get_cotizacion(cid: int, db: Session = Depends(get_db), user=Depends(require_permission("ventas", "read"))):
    c = db.get(Cotizacion, cid)
    if not c:
        raise HTTPException(404, "Cotización no encontrada")
    return svc.cotizacion_out(c)


@router.post("/cotizaciones", status_code=201)
def create_cotizacion(body: CotizacionCreate, db: Session = Depends(get_db),
                      user=Depends(require_permission("ventas", "create"))):
    c = _tx(db, user, lambda: svc.create_cotizacion(db, user, body), "cotizaciones:-")
    return svc.cotizacion_out(c)


@router.post("/cotizaciones/{cid}/convertir", status_code=201)
def convertir(cid: int, body: ConvertirIn, db: Session = Depends(get_db),
              user=Depends(require_permission("ventas", "create"))):
    v = _tx(db, user, lambda: svc.convertir_cotizacion(db, user, cid, body.almacen_id), f"cotizaciones:{cid}")
    return svc.venta_out(v)


# ---- Órdenes de venta / facturación
@router.get("/ordenes")
def list_ordenes(q: Optional[str] = None, estado: Optional[str] = None, cliente_id: Optional[int] = None,
                 db: Session = Depends(get_db), user=Depends(require_permission("ventas", "read"))):
    stmt = select(Venta).join(Cliente)
    if q:
        stmt = stmt.where(or_(Venta.numero_ov.ilike(f"%{q}%"), Cliente.razon_social.ilike(f"%{q}%"),
                              Venta.numero_comprobante.ilike(f"%{q}%")))
    if estado:
        stmt = stmt.where(Venta.estado == estado)
    if cliente_id:
        stmt = stmt.where(Venta.cliente_id == cliente_id)
    return {"items": [svc.venta_out(v, False) for v in db.scalars(stmt.order_by(Venta.id.desc()).limit(300))]}


@router.get("/ordenes/{vid}")
def get_orden(vid: int, db: Session = Depends(get_db), user=Depends(require_permission("ventas", "read"))):
    v = db.get(Venta, vid)
    if not v:
        raise HTTPException(404, "Orden de venta no encontrada")
    return svc.venta_out(v)


@router.post("/ordenes", status_code=201)
def create_orden(body: OrdenCreate, db: Session = Depends(get_db), user=Depends(require_permission("ventas", "create"))):
    v = _tx(db, user, lambda: svc.create_orden(db, user, body), "ventas:-")
    return svc.venta_out(v)


@router.post("/ordenes/{vid}/facturar")
def facturar(vid: int, body: FacturarIn, db: Session = Depends(get_db),
             user=Depends(require_permission("ventas", "approve"))):
    v = _tx(db, user, lambda: svc.facturar(db, user, vid, body.tipo_comprobante, body.serie), f"ventas:{vid}")
    return svc.venta_out(v)


@router.post("/ordenes/{vid}/anular")
def anular(vid: int, body: AnularIn, db: Session = Depends(get_db), user=Depends(require_permission("ventas", "update"))):
    v = _tx(db, user, lambda: svc.anular_venta(db, user, vid, body.motivo), f"ventas:{vid}")
    return svc.venta_out(v)


# ---- Estado de cuenta
def _cuenta_row(c: CuentaPorCobrar) -> dict:
    vencida = c.estado in ("PENDIENTE", "PARCIAL") and c.vencimiento < date.today()
    return dict(id=c.id, venta_id=c.venta_id, numero_ov=c.venta.numero_ov,
                comprobante=f"{c.venta.serie_comprobante}-{c.venta.numero_comprobante}" if c.venta.numero_comprobante else None,
                fecha=c.venta.fecha, vencimiento=c.vencimiento, monto_original=c.monto_original, saldo=c.saldo,
                estado=c.estado, vencida=vencida)


@router.get("/estado-cuenta")
def estado_cuenta_resumen(db: Session = Depends(get_db), user=Depends(require_permission("ventas", "read"))):
    rows = db.execute(select(Cliente, func.coalesce(func.sum(CuentaPorCobrar.saldo), 0))
                      .join(CuentaPorCobrar, CuentaPorCobrar.cliente_id == Cliente.id)
                      .where(CuentaPorCobrar.estado.in_(["PENDIENTE", "PARCIAL"]))
                      .group_by(Cliente.id).order_by(Cliente.razon_social)).all()
    return [dict(cliente_id=c.id, cliente=c.razon_social, documento=c.documento, limite_credito=c.limite_credito,
                 saldo_pendiente=s) for c, s in rows]


@router.get("/estado-cuenta/{cliente_id}")
def estado_cuenta(cliente_id: int, db: Session = Depends(get_db), user=Depends(require_permission("ventas", "read"))):
    cli = db.get(Cliente, cliente_id)
    if not cli:
        raise HTTPException(404, "Cliente no encontrado")
    cuentas = db.scalars(select(CuentaPorCobrar).where(CuentaPorCobrar.cliente_id == cliente_id)
                         .order_by(CuentaPorCobrar.vencimiento)).all()
    rows = [_cuenta_row(c) for c in cuentas]
    pend = sum((D(r["saldo"]) for r in rows if r["estado"] in ("PENDIENTE", "PARCIAL")), D(0))
    venc = sum((D(r["saldo"]) for r in rows if r["vencida"]), D(0))
    limite = D(cli.limite_credito)
    return dict(cliente=dict(id=cli.id, razon_social=cli.razon_social, documento=cli.documento,
                             limite_credito=limite), saldo_pendiente=pend, saldo_vencido=venc,
                credito_disponible=(limite - pend) if limite > 0 else None, documentos=rows)
