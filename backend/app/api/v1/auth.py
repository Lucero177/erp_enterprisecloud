from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Usuario
from app.security.hashing import verify_password
from app.security.jwt import create_access_token
from app.security.rbac import get_current_user, user_permissions
from app.services import audit_service

router = APIRouter(prefix="/auth", tags=["Autenticación"])


def _user_payload(u: Usuario) -> dict:
    return dict(id=u.id, username=u.username, nombre_completo=u.nombre_completo, email=u.email,
                empresa_id=u.empresa_id, rol=u.rol.nombre, permisos=sorted(user_permissions(u)))


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    u = db.scalar(select(Usuario).where(Usuario.username == form.username))
    if not u or not u.activo or not verify_password(form.password, u.password_hash):
        audit_service.log_isolated(u.id if u else None, "LOGIN", "seguridad", f"usuarios:{form.username}", "FALLO")
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    u.ultimo_login = datetime.now(timezone.utc)
    audit_service.log(db, u.id, "LOGIN", "seguridad", f"usuarios:{u.id}")
    db.commit()
    return {"access_token": create_access_token(u.id), "token_type": "bearer", "user": _user_payload(u)}


@router.get("/me")
def me(user: Usuario = Depends(get_current_user)):
    return _user_payload(user)
