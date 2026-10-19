from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Compra, CuentaPorCobrar, CuentaPorPagar, Estado, Producto, StockAlmacen, Venta
from app.security.rbac import require_permission
from app.services.pricing import D

router = APIRouter(prefix="/dashboard", tags=["Inicio · Dashboard"])
MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


def _month_start(d: date, offset: int = 0) -> date:
    m = d.month - 1 + offset
    return date(d.year + m // 12, m % 12 + 1, 1)


@router.get("")
def dashboard(db: Session = Depends(get_db), user=Depends(require_permission("dashboard", "read"))):
    hoy = date.today()
    compras_validas = Compra.estado.in_([Estado.EMITIDO, Estado.APROBADO, Estado.INGRESADO])

    def total_ventas(a, b):
        return D(db.scalar(select(func.coalesce(func.sum(Venta.total), 0))
                           .where(Venta.estado == Estado.FACTURADO, Venta.fecha >= a, Venta.fecha < b)))

    def total_compras(a, b):
        return D(db.scalar(select(func.coalesce(func.sum(Compra.total), 0))
                           .where(compras_validas, Compra.fecha >= a, Compra.fecha < b)))

    ini, fin = _month_start(hoy), _month_start(hoy, 1)
    serie = []
    for off in range(-5, 1):
        a, b = _month_start(hoy, off), _month_start(hoy, off + 1)
        serie.append(dict(mes=f"{MESES[a.month - 1]} {a.year % 100}", ventas=total_ventas(a, b), compras=total_compras(a, b)))
    valorizado = D(db.scalar(select(func.coalesce(func.sum(StockAlmacen.cantidad * Producto.costo_promedio), 0))
                             .join(Producto, Producto.id == StockAlmacen.producto_id)))
    alertas = db.execute(select(StockAlmacen, Producto).join(Producto, Producto.id == StockAlmacen.producto_id)
                         .where(StockAlmacen.cantidad <= Producto.stock_minimo, Producto.activo.is_(True))
                         .order_by(StockAlmacen.cantidad).limit(10)).all()
    cxc = D(db.scalar(select(func.coalesce(func.sum(CuentaPorCobrar.saldo), 0)).where(CuentaPorCobrar.estado.in_(["PENDIENTE", "PARCIAL"]))))
    cxp = D(db.scalar(select(func.coalesce(func.sum(CuentaPorPagar.saldo), 0)).where(CuentaPorPagar.estado.in_(["PENDIENTE", "PARCIAL"]))))
    return dict(
        kpis=dict(ventas_mes=total_ventas(ini, fin), compras_mes=total_compras(ini, fin),
                  inventario_valorizado=valorizado, cxc_pendiente=cxc, cxp_pendiente=cxp),
        serie=serie,
        alertas_stock=[dict(almacen=s.almacen.nombre, sku=p.sku, producto=p.nombre, cantidad=s.cantidad,
                            stock_minimo=p.stock_minimo) for s, p in alertas])
