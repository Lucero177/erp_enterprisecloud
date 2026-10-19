from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Usuario
from app.security.jwt import decode_token
from app.services import audit_service

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> Usuario:
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(401, "Token inválido o expirado", headers={"WWW-Authenticate": "Bearer"})
    user = db.get(Usuario, int(payload["sub"]))
    if not user or not user.activo:
        raise HTTPException(401, "Usuario inactivo o inexistente", headers={"WWW-Authenticate": "Bearer"})
    return user


def user_permissions(user: Usuario) -> set[str]:
    return {f"{p.modulo}:{p.accion}" for p in user.rol.permisos}


def require_permission(modulo: str, accion: str):
    def dependency(user: Usuario = Depends(get_current_user)) -> Usuario:
        if user.rol.nombre == "ADMIN":
            return user
        if f"{modulo}:{accion}" not in user_permissions(user):
            audit_service.log_isolated(user.id, accion.upper(), modulo, "-", "DENEGADO")
            raise HTTPException(403, "No tiene permiso para esta operación")
        return user
    return dependency
