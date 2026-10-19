from datetime import datetime
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

roles_permisos = Table(
    "roles_permisos",
    Base.metadata,
    Column("rol_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permiso_id", Integer, ForeignKey("permisos.id", ondelete="CASCADE"), primary_key=True),
)


class Permiso(Base):
    __tablename__ = "permisos"
    __table_args__ = (UniqueConstraint("modulo", "accion"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    modulo: Mapped[str] = mapped_column(String(50))
    accion: Mapped[str] = mapped_column(String(30))


class Rol(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(200))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=sa.true())
    permisos: Mapped[list[Permiso]] = relationship(secondary=roles_permisos, lazy="selectin")


class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    username: Mapped[str] = mapped_column(String(50), unique=True)
    email: Mapped[str] = mapped_column(String(150), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nombre_completo: Mapped[str] = mapped_column(String(150))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=sa.true())
    ultimo_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    rol: Mapped[Rol] = relationship(lazy="joined")
