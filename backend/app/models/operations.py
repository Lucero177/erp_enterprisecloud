import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

import sqlalchemy as sa
from sqlalchemy import (JSON, BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
                        Numeric, String, UniqueConstraint, Uuid, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BigPK, Estado
from app.models.masters import (Almacen, Cliente, FormaPago, Moneda, Producto, Proveedor, Transportista,
                                Vendedor)
from app.models.security import Usuario


def _num(prec=14, scale=2, default=0):
    return mapped_column(Numeric(prec, scale), default=default, server_default=str(default))


def _now():
    return mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------- COMPRAS
class Compra(Base):
    __tablename__ = "compras"
    __table_args__ = (UniqueConstraint("proveedor_id", "serie_comprobante", "numero_comprobante"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    numero_oc: Mapped[str] = mapped_column(String(20), unique=True)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id"))
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    moneda_id: Mapped[int] = mapped_column(ForeignKey("monedas.id"))
    forma_pago_id: Mapped[Optional[int]] = mapped_column(ForeignKey("formas_pago.id"))
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    subtotal: Mapped[Decimal] = _num()
    impuesto: Mapped[Decimal] = _num()
    total: Mapped[Decimal] = _num()
    estado: Mapped[str] = mapped_column(String(20), default=Estado.BORRADOR)
    tipo_comprobante: Mapped[Optional[str]] = mapped_column(String(20))
    serie_comprobante: Mapped[Optional[str]] = mapped_column(String(10))
    numero_comprobante: Mapped[Optional[str]] = mapped_column(String(20))
    fecha_ingreso: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    observaciones: Mapped[Optional[str]] = mapped_column(String(300))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    created_at: Mapped[datetime] = _now()
    proveedor: Mapped[Proveedor] = relationship()
    almacen: Mapped[Almacen] = relationship()
    moneda: Mapped[Moneda] = relationship()
    forma_pago: Mapped[Optional[FormaPago]] = relationship()
    detalles: Mapped[list["DetalleCompra"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                           order_by="DetalleCompra.id")


class DetalleCompra(Base):
    __tablename__ = "detalle_compras"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    producto: Mapped[Producto] = relationship()


# ---------------------------------------------------------------- VENTAS
class Cotizacion(Base):
    __tablename__ = "cotizaciones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"))
    vendedor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendedores.id"))
    moneda_id: Mapped[int] = mapped_column(ForeignKey("monedas.id"))
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    vigencia_hasta: Mapped[Optional[date]] = mapped_column(Date)
    subtotal: Mapped[Decimal] = _num()
    impuesto: Mapped[Decimal] = _num()
    total: Mapped[Decimal] = _num()
    estado: Mapped[str] = mapped_column(String(20), default=Estado.BORRADOR)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    created_at: Mapped[datetime] = _now()
    cliente: Mapped[Cliente] = relationship()
    moneda: Mapped[Moneda] = relationship()
    detalles: Mapped[list["DetalleCotizacion"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                               order_by="DetalleCotizacion.id")


class DetalleCotizacion(Base):
    __tablename__ = "detalle_cotizaciones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cotizacion_id: Mapped[int] = mapped_column(ForeignKey("cotizaciones.id", ondelete="CASCADE"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    descuento: Mapped[Decimal] = _num()
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    producto: Mapped[Producto] = relationship()


class Venta(Base):
    """Orden de venta; al facturarse se convierte en comprobante (estado FACTURADO)."""
    __tablename__ = "ventas"
    __table_args__ = (UniqueConstraint("tipo_comprobante", "serie_comprobante", "numero_comprobante"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    cotizacion_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cotizaciones.id"))
    numero_ov: Mapped[str] = mapped_column(String(20), unique=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"))
    vendedor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendedores.id"))
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    transportista_id: Mapped[Optional[int]] = mapped_column(ForeignKey("transportistas.id"))
    moneda_id: Mapped[int] = mapped_column(ForeignKey("monedas.id"))
    forma_pago_id: Mapped[Optional[int]] = mapped_column(ForeignKey("formas_pago.id"))
    fecha: Mapped[date] = mapped_column(Date, default=date.today)
    subtotal: Mapped[Decimal] = _num()
    impuesto: Mapped[Decimal] = _num()
    total: Mapped[Decimal] = _num()
    estado: Mapped[str] = mapped_column(String(20), default=Estado.BORRADOR)
    tipo_comprobante: Mapped[Optional[str]] = mapped_column(String(20))
    serie_comprobante: Mapped[Optional[str]] = mapped_column(String(10))
    numero_comprobante: Mapped[Optional[str]] = mapped_column(String(20))
    fecha_emision: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    created_at: Mapped[datetime] = _now()
    cliente: Mapped[Cliente] = relationship()
    almacen: Mapped[Almacen] = relationship()
    moneda: Mapped[Moneda] = relationship()
    forma_pago: Mapped[Optional[FormaPago]] = relationship()
    detalles: Mapped[list["DetalleVenta"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                          order_by="DetalleVenta.id")


class DetalleVenta(Base):
    __tablename__ = "detalle_ventas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    descuento: Mapped[Decimal] = _num()
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    producto: Mapped[Producto] = relationship()


# ---------------------------------------------------------------- KARDEX
class Kardex(Base):
    __tablename__ = "kardex"
    __table_args__ = (
        Index("idx_kardex_prod_alm_fecha", "producto_id", "almacen_id", "fecha"),
        CheckConstraint("compra_id IS NOT NULL OR venta_id IS NOT NULL OR tipo IN ('AJUSTE','TRANSFERENCIA')",
                        name="ck_kardex_origen"),
    )
    id: Mapped[int] = mapped_column(BigPK, primary_key=True)
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    tipo: Mapped[str] = mapped_column(String(15))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    costo_unitario: Mapped[Decimal] = _num(14, 4, 0)
    saldo_cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    saldo_valorizado: Mapped[Decimal] = mapped_column(Numeric(16, 4))
    compra_id: Mapped[Optional[int]] = mapped_column(ForeignKey("compras.id"))
    venta_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ventas.id"))
    motivo: Mapped[Optional[str]] = mapped_column(String(200))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    producto: Mapped[Producto] = relationship()
    almacen: Mapped[Almacen] = relationship()


# ---------------------------------------------------------------- TESORERÍA
class CuentaPorCobrar(Base):
    __tablename__ = "cuentas_por_cobrar"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id"))
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"))
    monto_original: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vencimiento: Mapped[date] = mapped_column(Date)
    estado: Mapped[str] = mapped_column(String(15), default="PENDIENTE")
    venta: Mapped[Venta] = relationship()
    cliente: Mapped[Cliente] = relationship()


class CuentaPorPagar(Base):
    __tablename__ = "cuentas_por_pagar"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id"))
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id"))
    monto_original: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    vencimiento: Mapped[date] = mapped_column(Date)
    estado: Mapped[str] = mapped_column(String(15), default="PENDIENTE")
    compra: Mapped[Compra] = relationship()
    proveedor: Mapped[Proveedor] = relationship()


class MovimientoCaja(Base):
    __tablename__ = "movimientos_caja"
    id: Mapped[int] = mapped_column(BigPK, primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    tipo: Mapped[str] = mapped_column(String(10))
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    moneda_id: Mapped[int] = mapped_column(ForeignKey("monedas.id"))
    forma_pago_id: Mapped[Optional[int]] = mapped_column(ForeignKey("formas_pago.id"))
    cxc_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cuentas_por_cobrar.id"))
    cxp_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cuentas_por_pagar.id"))
    concepto: Mapped[Optional[str]] = mapped_column(String(200))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    moneda: Mapped[Moneda] = relationship()

    __table_args__ = (CheckConstraint("tipo IN ('INGRESO','EGRESO')", name="ck_caja_tipo"),
                      CheckConstraint("monto > 0", name="ck_caja_monto"))


# ---------------------------------------------------------------- DOCUMENTOS / AUDITORÍA
class DocumentoAdjunto(Base):
    __tablename__ = "documentos_adjuntos"
    __table_args__ = (Index("idx_docs_entidad", "entidad", "entidad_id"),)
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    entidad: Mapped[str] = mapped_column(String(30))
    entidad_id: Mapped[int] = mapped_column(Integer)
    nombre_original: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    tamano_bytes: Mapped[int] = mapped_column(BigInteger)
    s3_bucket: Mapped[str] = mapped_column(String(100))
    s3_key: Mapped[str] = mapped_column(String(500))
    checksum_sha256: Mapped[Optional[str]] = mapped_column(String(64))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    created_at: Mapped[datetime] = _now()


class Auditoria(Base):
    __tablename__ = "auditoria"
    __table_args__ = (Index("idx_audit_modulo_fecha", "modulo", "fecha_hora"),
                      Index("idx_audit_usuario", "usuario_id", "fecha_hora"))
    id: Mapped[int] = mapped_column(BigPK, primary_key=True)
    usuario_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id"))
    accion: Mapped[str] = mapped_column(String(30))
    modulo: Mapped[str] = mapped_column(String(50))
    registro_afectado: Mapped[str] = mapped_column(String(100))
    fecha_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    resultado: Mapped[str] = mapped_column(String(10))
    ip_origen: Mapped[Optional[str]] = mapped_column(String(45))
    detalle: Mapped[Optional[Any]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    usuario: Mapped[Optional[Usuario]] = relationship()
