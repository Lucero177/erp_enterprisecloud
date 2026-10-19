from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Moneda, Producto, TipoCambio


def D(x) -> Decimal:
    return x if isinstance(x, Decimal) else Decimal(str(x if x is not None else 0))


def q2(x) -> Decimal:
    return D(x).quantize(Decimal("0.01"), ROUND_HALF_UP)


def q3(x) -> Decimal:
    return D(x).quantize(Decimal("0.001"), ROUND_HALF_UP)


def q4(x) -> Decimal:
    return D(x).quantize(Decimal("0.0001"), ROUND_HALF_UP)


def calc_lines(db: Session, lineas) -> tuple[list[dict], Decimal, Decimal, Decimal]:
    """Calcula subtotales por línea, impuesto (por producto, IGV por defecto) y totales."""
    ids = [l.producto_id for l in lineas]
    prods = {p.id: p for p in db.scalars(select(Producto).where(Producto.id.in_(ids)))}
    out, sub, imp = [], Decimal(0), Decimal(0)
    for l in lineas:
        p = prods.get(l.producto_id)
        if not p or not p.activo:
            raise HTTPException(422, f"El producto {l.producto_id} no existe o está inactivo")
        cant, precio, desc = D(l.cantidad), D(l.precio_unitario), D(getattr(l, "descuento", 0))
        s = q2(cant * precio - desc)
        if s < 0:
            raise HTTPException(422, f"El descuento supera el importe de la línea ({p.sku})")
        pct = D(p.impuesto.porcentaje) if p.impuesto else D(settings.DEFAULT_IGV)
        imp += q2(s * pct / 100)
        sub += s
        out.append(dict(producto_id=p.id, cantidad=cant, precio_unitario=precio, descuento=desc, subtotal=s))
    return out, sub, imp, sub + imp


def to_base(db: Session, moneda_id: int, fecha: date, monto) -> Decimal:
    """Convierte a moneda base usando el último tipo de cambio (venta) <= fecha."""
    m = db.get(Moneda, moneda_id)
    if not m:
        raise HTTPException(422, "Moneda inválida")
    if m.codigo == settings.BASE_CURRENCY:
        return D(monto)
    tc = db.scalar(select(TipoCambio).where(TipoCambio.moneda_id == moneda_id, TipoCambio.fecha <= fecha)
                   .order_by(TipoCambio.fecha.desc()).limit(1))
    if not tc:
        raise HTTPException(422, f"Falta registrar el tipo de cambio de {m.codigo} para {fecha}")
    return D(monto) * D(tc.venta)
