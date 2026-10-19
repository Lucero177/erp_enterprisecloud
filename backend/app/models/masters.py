from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import (Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _pk():
    return mapped_column(Integer, primary_key=True)


def _active():
    return mapped_column(Boolean, default=True, server_default=sa.true())


def _num(prec=14, scale=2, default=0):
    return mapped_column(Numeric(prec, scale), default=default, server_default=str(default))


class Empresa(Base):
    __tablename__ = "empresas"
    id: Mapped[int] = _pk()
    ruc: Mapped[str] = mapped_column(String(11), unique=True)
    razon_social: Mapped[str] = mapped_column(String(200))
    direccion: Mapped[Optional[str]] = mapped_column(String(250))
    activo: Mapped[bool] = _active()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Sucursal(Base):
    __tablename__ = "sucursales"
    __table_args__ = (UniqueConstraint("empresa_id", "nombre"),)
    id: Mapped[int] = _pk()
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    nombre: Mapped[str] = mapped_column(String(120))
    direccion: Mapped[Optional[str]] = mapped_column(String(250))
    activo: Mapped[bool] = _active()


class Almacen(Base):
    __tablename__ = "almacenes"
    id: Mapped[int] = _pk()
    sucursal_id: Mapped[int] = mapped_column(ForeignKey("sucursales.id"))
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    activo: Mapped[bool] = _active()


class Zona(Base):
    __tablename__ = "zonas"
    id: Mapped[int] = _pk()
    nombre: Mapped[str] = mapped_column(String(80), unique=True)


class Vendedor(Base):
    __tablename__ = "vendedores"
    id: Mapped[int] = _pk()
    nombre: Mapped[str] = mapped_column(String(150))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    zona_id: Mapped[Optional[int]] = mapped_column(ForeignKey("zonas.id"))
    activo: Mapped[bool] = _active()


class Moneda(Base):
    __tablename__ = "monedas"
    id: Mapped[int] = _pk()
    codigo: Mapped[str] = mapped_column(String(3), unique=True)
    nombre: Mapped[str] = mapped_column(String(50))
    simbolo: Mapped[Optional[str]] = mapped_column(String(5))


class TipoCambio(Base):
    __tablename__ = "tipos_cambio"
    __table_args__ = (UniqueConstraint("moneda_id", "fecha"),)
    id: Mapped[int] = _pk()
    moneda_id: Mapped[int] = mapped_column(ForeignKey("monedas.id"))
    fecha: Mapped[date] = mapped_column(Date)
    compra: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    venta: Mapped[Decimal] = mapped_column(Numeric(10, 4))


class Impuesto(Base):
    __tablename__ = "impuestos"
    id: Mapped[int] = _pk()
    codigo: Mapped[str] = mapped_column(String(10), unique=True)
    nombre: Mapped[str] = mapped_column(String(50))
    porcentaje: Mapped[Decimal] = _num(5, 2, 18)


class FormaPago(Base):
    __tablename__ = "formas_pago"
    id: Mapped[int] = _pk()
    nombre: Mapped[str] = mapped_column(String(60), unique=True)
    dias_credito: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class ListaPrecios(Base):
    __tablename__ = "listas_precios"
    id: Mapped[int] = _pk()
    nombre: Mapped[str] = mapped_column(String(80))
    moneda_id: Mapped[int] = mapped_column(ForeignKey("monedas.id"))
    vigente_desde: Mapped[date] = mapped_column(Date)
    vigente_hasta: Mapped[Optional[date]] = mapped_column(Date)
    activo: Mapped[bool] = _active()


class ListaPreciosDetalle(Base):
    __tablename__ = "listas_precios_detalle"
    lista_id: Mapped[int] = mapped_column(ForeignKey("listas_precios.id", ondelete="CASCADE"), primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), primary_key=True)
    precio: Mapped[Decimal] = mapped_column(Numeric(14, 4))


class Cliente(Base):
    __tablename__ = "clientes"
    __table_args__ = (UniqueConstraint("empresa_id", "documento"),)
    id: Mapped[int] = _pk()
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    documento: Mapped[str] = mapped_column(String(15))
    razon_social: Mapped[str] = mapped_column(String(200))
    direccion: Mapped[Optional[str]] = mapped_column(String(250))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    zona_id: Mapped[Optional[int]] = mapped_column(ForeignKey("zonas.id"))
    vendedor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendedores.id"))
    forma_pago_id: Mapped[Optional[int]] = mapped_column(ForeignKey("formas_pago.id"))
    lista_precios_id: Mapped[Optional[int]] = mapped_column(ForeignKey("listas_precios.id"))
    limite_credito: Mapped[Decimal] = _num(14, 2, 0)
    activo: Mapped[bool] = _active()
    forma_pago: Mapped[Optional[FormaPago]] = relationship()


class Proveedor(Base):
    __tablename__ = "proveedores"
    __table_args__ = (UniqueConstraint("empresa_id", "ruc"),)
    id: Mapped[int] = _pk()
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    ruc: Mapped[str] = mapped_column(String(11))
    razon_social: Mapped[str] = mapped_column(String(200))
    direccion: Mapped[Optional[str]] = mapped_column(String(250))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    forma_pago_id: Mapped[Optional[int]] = mapped_column(ForeignKey("formas_pago.id"))
    activo: Mapped[bool] = _active()
    forma_pago: Mapped[Optional[FormaPago]] = relationship()


class Transportista(Base):
    __tablename__ = "transportistas"
    id: Mapped[int] = _pk()
    ruc: Mapped[str] = mapped_column(String(11), unique=True)
    razon_social: Mapped[str] = mapped_column(String(200))
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    activo: Mapped[bool] = _active()


class Categoria(Base):
    __tablename__ = "categorias"
    id: Mapped[int] = _pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    padre_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categorias.id"))


class Marca(Base):
    __tablename__ = "marcas"
    id: Mapped[int] = _pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True)


class UnidadMedida(Base):
    __tablename__ = "unidades_medida"
    id: Mapped[int] = _pk()
    codigo: Mapped[str] = mapped_column(String(10), unique=True)
    nombre: Mapped[str] = mapped_column(String(60))


class ConversionUnidad(Base):
    __tablename__ = "conversion_unidades"
    __table_args__ = (UniqueConstraint("unidad_origen_id", "unidad_destino_id"),)
    id: Mapped[int] = _pk()
    unidad_origen_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"))
    unidad_destino_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"))
    factor: Mapped[Decimal] = mapped_column(Numeric(14, 6))


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (UniqueConstraint("empresa_id", "sku"),)
    id: Mapped[int] = _pk()
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresas.id"))
    sku: Mapped[str] = mapped_column(String(40))
    nombre: Mapped[str] = mapped_column(String(200))
    categoria_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categorias.id"))
    marca_id: Mapped[Optional[int]] = mapped_column(ForeignKey("marcas.id"))
    unidad_id: Mapped[int] = mapped_column(ForeignKey("unidades_medida.id"))
    impuesto_id: Mapped[Optional[int]] = mapped_column(ForeignKey("impuestos.id"))
    stock_minimo: Mapped[Decimal] = _num(14, 3, 0)
    costo_promedio: Mapped[Decimal] = _num(14, 4, 0)
    activo: Mapped[bool] = _active()
    impuesto: Mapped[Optional[Impuesto]] = relationship()
    unidad: Mapped[UnidadMedida] = relationship()


class StockAlmacen(Base):
    __tablename__ = "stock_almacen"
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"), primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), primary_key=True)
    cantidad: Mapped[Decimal] = _num(14, 3, 0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=func.now())
    producto: Mapped[Producto] = relationship()
    almacen: Mapped[Almacen] = relationship()
