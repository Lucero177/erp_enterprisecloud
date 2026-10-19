from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Permiso, Rol, Usuario
from app.schemas.operations import RolPermisosIn, UserCreate, UserUpdate
from app.security.hashing import hash_password
from app.security.rbac import require_permission
from app.services import audit_service

router = APIRouter(prefix="/users", tags=["Seguridad · Usuarios y roles"])


def _out(u: Usuario) -> dict:
    return dict(id=u.id, username=u.username, email=u.email, nombre_completo=u.nombre_completo,
                rol_id=u.rol_id, rol=u.rol.nombre, activo=u.activo, ultimo_login=u.ultimo_login)


@router.get("")
def list_users(db: Session = Depends(get_db), user=Depends(require_permission("seguridad", "read"))):
    return [_out(u) for u in db.scalars(select(Usuario).order_by(Usuario.id))]


@router.post("", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db),
                user=Depends(require_permission("seguridad", "create"))):
    if not db.get(Rol, body.rol_id):
        raise HTTPException(422, "Rol no encontrado")
    u = Usuario(empresa_id=user.empresa_id, rol_id=body.rol_id, username=body.username, email=body.email,
                nombre_completo=body.nombre_completo, password_hash=hash_password(body.password), activo=body.activo)
    db.add(u)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El usuario o el correo ya existen")
    audit_service.log(db, user.id, "INSERT", "seguridad", f"usuarios:{u.id}", detalle={"username": u.username})
    db.commit()
    db.refresh(u)
    return _out(u)


@router.put("/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db),
                user=Depends(require_permission("seguridad", "update"))):
    u = db.get(Usuario, user_id)
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        u.password_hash = hash_password(data.pop("password"))
    if data.get("activo") is False and u.id == user.id:
        raise HTTPException(409, "No puede desactivar su propio usuario")
    for k, v in data.items():
        setattr(u, k, v)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El correo ya está en uso")
    audit_service.log(db, user.id, "UPDATE", "seguridad", f"usuarios:{u.id}", detalle={"campos": list(body.model_dump(exclude_unset=True))})
    db.commit()
    db.refresh(u)
    return _out(u)


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), user=Depends(require_permission("seguridad", "read"))):
    return [dict(id=r.id, nombre=r.nombre, descripcion=r.descripcion, permisos=[p.id for p in r.permisos])
            for r in db.scalars(select(Rol).order_by(Rol.id))]


@router.get("/permisos")
def list_permisos(db: Session = Depends(get_db), user=Depends(require_permission("seguridad", "read"))):
    return [dict(id=p.id, modulo=p.modulo, accion=p.accion)
            for p in db.scalars(select(Permiso).order_by(Permiso.modulo, Permiso.accion))]


@router.put("/roles/{rol_id}/permisos")
def set_role_permissions(rol_id: int, body: RolPermisosIn, db: Session = Depends(get_db),
                         user=Depends(require_permission("seguridad", "update"))):
    rol = db.get(Rol, rol_id)
    if not rol:
        raise HTTPException(404, "Rol no encontrado")
    if rol.nombre == "ADMIN":
        raise HTTPException(409, "El rol ADMIN no es editable")
    rol.permisos = list(db.scalars(select(Permiso).where(Permiso.id.in_(body.permisos))))
    audit_service.log(db, user.id, "UPDATE", "seguridad", f"roles:{rol.id}", detalle={"permisos": len(rol.permisos)})
    db.commit()
    return {"ok": True, "permisos": [p.id for p in rol.permisos]}
