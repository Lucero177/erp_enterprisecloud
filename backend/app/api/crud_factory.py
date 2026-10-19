from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ConfigDict, create_model
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.security.rbac import require_permission
from app.services import audit_service


def _py(col):
    t = col.type.python_type
    return float if t is Decimal else t


def build_schemas(model):
    cols = sa.inspect(model).columns
    f_in, f_up, f_out = {}, {}, {}
    for c in cols:
        t = _py(c)
        f_out[c.key] = (Optional[t], None)
        if c.primary_key or c.key == "created_at":
            continue
        required = not c.nullable and c.default is None and c.server_default is None
        f_in[c.key] = (t, ...) if required else (Optional[t], None)
        f_up[c.key] = (Optional[t], None)
    cfg = ConfigDict(from_attributes=True)
    n = model.__name__
    return (create_model(f"{n}In", __config__=cfg, **f_in), create_model(f"{n}Up", __config__=cfg, **f_up),
            create_model(f"{n}Out", __config__=cfg, **f_out))


def crud_router(model, slug: str, label: str, search: tuple = (), modulo: str = "maestros") -> APIRouter:
    r = APIRouter(prefix=f"/{slug}", tags=[f"Maestros · {label}"])
    CIn, CUp, COut = build_schemas(model)
    mod = f"{modulo}:{slug}"

    @r.get("")
    def list_items(q: Optional[str] = None, activo: Optional[bool] = None, skip: int = 0,
                   limit: int = Query(500, le=2000), db: Session = Depends(get_db),
                   user=Depends(require_permission(modulo, "read"))):
        stmt = select(model)
        if q and search:
            stmt = stmt.where(or_(*[getattr(model, c).ilike(f"%{q}%") for c in search]))
        if activo is not None and hasattr(model, "activo"):
            stmt = stmt.where(model.activo == activo)
        total = db.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = db.scalars(stmt.order_by(model.id).offset(skip).limit(limit)).all()
        return {"items": [COut.model_validate(x).model_dump(mode="json") for x in rows], "total": total}

    @r.get("/{item_id}")
    def get_item(item_id: int, db: Session = Depends(get_db), user=Depends(require_permission(modulo, "read"))):
        obj = db.get(model, item_id)
        if not obj:
            raise HTTPException(404, f"{label} no encontrado")
        return COut.model_validate(obj).model_dump(mode="json")

    @r.post("", status_code=201)
    def create_item(body: CIn, db: Session = Depends(get_db), user=Depends(require_permission(modulo, "create"))):
        obj = model(**body.model_dump(exclude_unset=True))
        db.add(obj)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            audit_service.log_isolated(user.id, "INSERT", mod, slug, "FALLO", {"error": "duplicado/FK"})
            raise HTTPException(409, f"{label}: registro duplicado o referencia inválida")
        audit_service.log(db, user.id, "INSERT", mod, f"{slug}:{obj.id}")
        db.commit()
        return COut.model_validate(obj).model_dump(mode="json")

    @r.put("/{item_id}")
    def update_item(item_id: int, body: CUp, db: Session = Depends(get_db),
                    user=Depends(require_permission(modulo, "update"))):
        obj = db.get(model, item_id)
        if not obj:
            raise HTTPException(404, f"{label} no encontrado")
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, f"{label}: registro duplicado o referencia inválida")
        audit_service.log(db, user.id, "UPDATE", mod, f"{slug}:{obj.id}")
        db.commit()
        return COut.model_validate(obj).model_dump(mode="json")

    @r.delete("/{item_id}")
    def delete_item(item_id: int, db: Session = Depends(get_db), user=Depends(require_permission(modulo, "delete"))):
        obj = db.get(model, item_id)
        if not obj:
            raise HTTPException(404, f"{label} no encontrado")
        if hasattr(obj, "activo"):          # baja lógica
            obj.activo = False
            accion = "DESACTIVAR"
        else:
            db.delete(obj)
            accion = "DELETE"
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, f"{label} está en uso y no puede eliminarse")
        audit_service.log(db, user.id, accion, mod, f"{slug}:{item_id}")
        db.commit()
        return {"ok": True}

    return r
