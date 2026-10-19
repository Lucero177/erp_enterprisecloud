from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class LineaCompraIn(BaseModel):
    producto_id: int
    cantidad: float = Field(gt=0)
    precio_unitario: float = Field(ge=0)


class LineaVentaIn(LineaCompraIn):
    descuento: float = Field(default=0, ge=0)


class PurchaseCreate(BaseModel):
    proveedor_id: int
    almacen_id: int
    moneda_id: int
    forma_pago_id: Optional[int] = None
    fecha: Optional[date] = None
    observaciones: Optional[str] = Field(default=None, max_length=300)
    emitir: bool = False
    lineas: list[LineaCompraIn] = Field(min_length=1)


class KardexEntryIn(BaseModel):
    compra_id: int
    tipo_comprobante: Literal["FACTURA", "GUIA_REMISION", "BOLETA"]
    serie: str = Field(min_length=1, max_length=10)
    numero: str = Field(min_length=1, max_length=20)
    fecha_ingreso: Optional[datetime] = None
    observaciones: Optional[str] = None


class AjusteIn(BaseModel):
    almacen_id: int
    producto_id: int
    cantidad: float                      # con signo: + entrada, - salida
    motivo: str = Field(min_length=3, max_length=200)


class CotizacionCreate(BaseModel):
    cliente_id: int
    vendedor_id: Optional[int] = None
    moneda_id: int
    vigencia_hasta: Optional[date] = None
    emitir: bool = True
    lineas: list[LineaVentaIn] = Field(min_length=1)


class ConvertirIn(BaseModel):
    almacen_id: int


class OrdenCreate(BaseModel):
    cliente_id: int
    vendedor_id: Optional[int] = None
    almacen_id: int
    transportista_id: Optional[int] = None
    moneda_id: int
    forma_pago_id: Optional[int] = None
    emitir: bool = True
    lineas: list[LineaVentaIn] = Field(min_length=1)


class FacturarIn(BaseModel):
    tipo_comprobante: Literal["FACTURA", "BOLETA"] = "FACTURA"
    serie: Optional[str] = Field(default=None, max_length=10)


class AnularIn(BaseModel):
    motivo: Optional[str] = Field(default=None, max_length=200)


class PagoIn(BaseModel):
    monto: float = Field(gt=0)
    forma_pago_id: Optional[int] = None
    concepto: Optional[str] = Field(default=None, max_length=200)


class CajaIn(BaseModel):
    tipo: Literal["INGRESO", "EGRESO"]
    monto: float = Field(gt=0)
    moneda_id: int
    forma_pago_id: Optional[int] = None
    concepto: str = Field(min_length=3, max_length=200)


class PresignIn(BaseModel):
    entidad: Literal["compra", "venta"]
    entidad_id: int
    nombre: str = Field(min_length=1, max_length=255)
    mime_type: str
    tamano_bytes: int = Field(gt=0)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5, max_length=150)
    nombre_completo: str = Field(min_length=3, max_length=150)
    password: str = Field(min_length=8, max_length=72)
    rol_id: int
    activo: bool = True


class UserUpdate(BaseModel):
    email: Optional[str] = None
    nombre_completo: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)
    rol_id: Optional[int] = None
    activo: Optional[bool] = None


class RolPermisosIn(BaseModel):
    permisos: list[int]
