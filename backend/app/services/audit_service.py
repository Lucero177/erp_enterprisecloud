from contextvars import ContextVar
from typing import Any

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Auditoria

request_ip: ContextVar[str | None] = ContextVar("request_ip", default=None)


def log(db: Session, usuario_id: int | None, accion: str, modulo: str, registro: str,
        resultado: str = "EXITO", detalle: Any = None) -> None:
    """Registra auditoría dentro de la MISMA transacción de la operación (atómica con ella)."""
    db.add(Auditoria(usuario_id=usuario_id, accion=accion, modulo=modulo, registro_afectado=registro,
                     resultado=resultado, detalle=detalle, ip_origen=request_ip.get()))


def log_isolated(usuario_id: int | None, accion: str, modulo: str, registro: str,
                 resultado: str, detalle: Any = None) -> None:
    """Registra auditoría en transacción propia (para fallos/denegados cuando la operación hizo rollback)."""
    try:
        with SessionLocal() as s:
            log(s, usuario_id, accion, modulo, registro, resultado, detalle)
            s.commit()
    except Exception:  # la auditoría de fallos nunca debe tumbar la respuesta
        pass
