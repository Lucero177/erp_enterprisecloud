from datetime import date, datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Compra, Proveedor
from app.schemas.operations import PurchaseCreate
from app.security.rbac import require_permission
from app.services import audit_service, purchase_service as svc

router = APIRouter(prefix="/purchases", tags=["Compras · Orden de compra"])


@router.get("")
def list_purchases(q: Optional[str] = Query(None, description="N° OC, RUC o razón social"),
                   proveedor_id: Optional[int] = None, estado: Optional[str] = None,
                   desde: Optional[date] = None, hasta: Optional[date] = None,
                   skip: int = 0, limit: int = Query(100, le=500), db: Session = Depends(get_db),
                   user=Depends(require_permission("compras", "read"))):
    stmt = select(Compra).join(Proveedor)
    if q:
        stmt = stmt.where(or_(Compra.numero_oc.ilike(f"%{q}%"), Proveedor.ruc.ilike(f"%{q}%"),
                              Proveedor.razon_social.ilike(f"%{q}%")))
    if proveedor_id:
        stmt = stmt.where(Compra.proveedor_id == proveedor_id)
    if estado:
        stmt = stmt.where(Compra.estado == estado)
    if desde:
        stmt = stmt.where(Compra.fecha >= desde)
    if hasta:
        stmt = stmt.where(Compra.fecha <= hasta)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Compra.id.desc()).offset(skip).limit(limit)).all()
    return {"items": [svc.compra_out(c, detail=False) for c in rows], "total": total}


@router.get("/{compra_id}")
def get_purchase(compra_id: int, db: Session = Depends(get_db), user=Depends(require_permission("compras", "read"))):
    c = db.get(Compra, compra_id)
    if not c:
        raise HTTPException(404, "Orden de compra no encontrada")
    return svc.compra_out(c)


@router.post("", status_code=201)
def create_purchase(body: PurchaseCreate, db: Session = Depends(get_db),
                    user=Depends(require_permission("compras", "create"))):
    try:
        c = svc.create_purchase(db, user, body)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        audit_service.log_isolated(user.id, "INSERT", "compras", "compras:-", "FALLO")
        raise
    return svc.compra_out(c)


@router.post("/{compra_id}/emitir")
def emitir(compra_id: int, db: Session = Depends(get_db), user=Depends(require_permission("compras", "update"))):
    try:
        c = svc.change_state(db, user, compra_id, "emitir")
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    return svc.compra_out(c)


@router.post("/{compra_id}/anular")
def anular(compra_id: int, db: Session = Depends(get_db), user=Depends(require_permission("compras", "update"))):
    try:
        c = svc.change_state(db, user, compra_id, "anular")
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    return svc.compra_out(c)
