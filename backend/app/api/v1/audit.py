from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Auditoria
from app.security.rbac import require_permission

router = APIRouter(prefix="/audit", tags=["Seguridad · Auditoría"])


@router.get("")
def list_audit(modulo: Optional[str] = None, accion: Optional[str] = None, usuario_id: Optional[int] = None,
               resultado: Optional[str] = None, desde: Optional[date] = None, hasta: Optional[date] = None,
               skip: int = 0, limit: int = Query(100, le=500), db: Session = Depends(get_db),
               user=Depends(require_permission("auditoria", "read"))):
    stmt = select(Auditoria)
    if modulo:
        stmt = stmt.where(Auditoria.modulo.ilike(f"{modulo}%"))
    if accion:
        stmt = stmt.where(Auditoria.accion == accion)
    if usuario_id:
        stmt = stmt.where(Auditoria.usuario_id == usuario_id)
    if resultado:
        stmt = stmt.where(Auditoria.resultado == resultado)
    if desde:
        stmt = stmt.where(Auditoria.fecha_hora >= datetime.combine(desde, time.min, tzinfo=timezone.utc))
    if hasta:
        stmt = stmt.where(Auditoria.fecha_hora <= datetime.combine(hasta, time.max, tzinfo=timezone.utc))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Auditoria.id.desc()).offset(skip).limit(limit)).all()
    return {"total": total, "items": [dict(
        id=a.id, usuario=a.usuario.username if a.usuario else None, accion=a.accion, modulo=a.modulo,
        registro_afectado=a.registro_afectado, fecha_hora=a.fecha_hora, resultado=a.resultado, ip_origen=a.ip_origen,
        detalle=a.detalle) for a in rows]}
