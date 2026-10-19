from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Kardex, Producto, StockAlmacen
from app.schemas.operations import AjusteIn, KardexEntryIn
from app.security.rbac import require_permission
from app.services import audit_service, kardex_service, purchase_service
from app.services.pricing import D

router = APIRouter(prefix="/inventory", tags=["Inventario y Kardex"])


@router.post("/kardex-entry")
def kardex_entry(body: KardexEntryIn, db: Session = Depends(get_db),
                 user=Depends(require_permission("compras", "approve"))):
    """Ingreso atómico: cierra la orden, registra movimientos de kardex y actualiza existencias del almacén."""
    try:
        compra = kardex_service.purchase_entry(db, user, body)
        db.commit()
    except HTTPException as e:
        db.rollback()
        audit_service.log_isolated(user.id, "KARDEX_ENTRY", "inventario", f"compras:{body.compra_id}", "FALLO",
                                   {"error": e.detail})
        raise
    except Exception as e:
        db.rollback()
        audit_service.log_isolated(user.id, "KARDEX_ENTRY", "inventario", f"compras:{body.compra_id}", "FALLO",
                                   {"error": str(e)[:200]})
        raise HTTPException(500, "Error interno al registrar el ingreso; la operación fue revertida")
    return purchase_service.compra_out(compra)


@router.post("/adjustment")
def adjustment(body: AjusteIn, db: Session = Depends(get_db), user=Depends(require_permission("inventario", "create"))):
    prod = db.get(Producto, body.producto_id)
    if not prod:
        raise HTTPException(422, "Producto no encontrado")
    if body.cantidad == 0:
        raise HTTPException(422, "La cantidad no puede ser cero")
    try:
        row = kardex_service.apply_movement(db, user.id, almacen_id=body.almacen_id, producto=prod, tipo="AJUSTE",
                                            cantidad=D(body.cantidad),
                                            costo_unitario=prod.costo_promedio if body.cantidad > 0 else None,
                                            motivo=body.motivo)
        audit_service.log(db, user.id, "AJUSTE", "inventario", f"productos:{prod.id}",
                          detalle={"cantidad": body.cantidad, "motivo": body.motivo})
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    return {"ok": True, "saldo": row.saldo_cantidad}


@router.get("/stock")
def stock(almacen_id: Optional[int] = None, q: Optional[str] = None, solo_alertas: bool = False,
          db: Session = Depends(get_db), user=Depends(require_permission("inventario", "read"))):
    stmt = select(StockAlmacen).join(Producto)
    if almacen_id:
        stmt = stmt.where(StockAlmacen.almacen_id == almacen_id)
    if q:
        stmt = stmt.where(Producto.nombre.ilike(f"%{q}%") | Producto.sku.ilike(f"%{q}%"))
    if solo_alertas:
        stmt = stmt.where(StockAlmacen.cantidad <= Producto.stock_minimo)
    out = []
    for s in db.scalars(stmt.order_by(Producto.nombre)):
        p, cant = s.producto, D(s.cantidad)
        estado = "SIN_STOCK" if cant <= 0 else ("BAJO" if cant <= D(p.stock_minimo) else "OK")
        out.append(dict(almacen_id=s.almacen_id, almacen=s.almacen.nombre, producto_id=p.id, sku=p.sku,
                        producto=p.nombre, unidad=p.unidad.codigo, cantidad=cant, stock_minimo=p.stock_minimo,
                        costo_promedio=p.costo_promedio, valorizado=cant * D(p.costo_promedio), estado=estado))
    return out


@router.get("/kardex")
def kardex(producto_id: Optional[int] = None, almacen_id: Optional[int] = None, tipo: Optional[str] = None,
           desde: Optional[date] = None, hasta: Optional[date] = None, skip: int = 0,
           limit: int = Query(200, le=1000), db: Session = Depends(get_db),
           user=Depends(require_permission("inventario", "read"))):
    stmt = select(Kardex)
    if producto_id:
        stmt = stmt.where(Kardex.producto_id == producto_id)
    if almacen_id:
        stmt = stmt.where(Kardex.almacen_id == almacen_id)
    if tipo:
        stmt = stmt.where(Kardex.tipo == tipo)
    if desde:
        stmt = stmt.where(Kardex.fecha >= datetime.combine(desde, time.min, tzinfo=timezone.utc))
    if hasta:
        stmt = stmt.where(Kardex.fecha <= datetime.combine(hasta, time.max, tzinfo=timezone.utc))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Kardex.id.desc()).offset(skip).limit(limit)).all()
    return {"total": total, "items": [dict(
        id=k.id, fecha=k.fecha, tipo=k.tipo, almacen=k.almacen.nombre, sku=k.producto.sku,
        producto=k.producto.nombre, cantidad=k.cantidad, costo_unitario=k.costo_unitario,
        saldo_cantidad=k.saldo_cantidad, saldo_valorizado=k.saldo_valorizado, compra_id=k.compra_id,
        venta_id=k.venta_id, motivo=k.motivo) for k in rows]}
