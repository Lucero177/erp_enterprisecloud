from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models import (Compra, CuentaPorPagar, Estado, Kardex, Producto, StockAlmacen, Usuario)
from app.services import audit_service
from app.services.pricing import D, q2, q3, q4, to_base


def _locked_stock(db: Session, almacen_id: int, producto_id: int) -> StockAlmacen:
    st = db.execute(select(StockAlmacen).where(and_(StockAlmacen.almacen_id == almacen_id,
                                                    StockAlmacen.producto_id == producto_id))
                    .with_for_update()).scalar_one_or_none()
    if not st:
        st = StockAlmacen(almacen_id=almacen_id, producto_id=producto_id, cantidad=Decimal(0))
        db.add(st)
        db.flush()
    return st


def apply_movement(db: Session, user_id: int, *, almacen_id: int, producto: Producto, tipo: str,
                   cantidad: Decimal, costo_unitario: Decimal | None = None,
                   compra_id: int | None = None, venta_id: int | None = None,
                   motivo: str | None = None) -> Kardex:
    """Aplica un movimiento (cantidad con signo): actualiza stock del almacén, costo promedio y kardex."""
    cantidad = q3(cantidad)
    st = _locked_stock(db, almacen_id, producto.id)
    previo = D(st.cantidad)
    nuevo = previo + cantidad
    if nuevo < 0:
        raise HTTPException(409, f"Stock insuficiente de {producto.sku}: disponible {previo}, requerido {-cantidad}")
    if cantidad > 0 and costo_unitario is not None:
        total_prev = D(db.scalar(select(func.coalesce(func.sum(StockAlmacen.cantidad), 0))
                                 .where(StockAlmacen.producto_id == producto.id)))
        if total_prev > 0:
            producto.costo_promedio = q4((total_prev * D(producto.costo_promedio) + cantidad * D(costo_unitario))
                                         / (total_prev + cantidad))
        else:
            producto.costo_promedio = q4(costo_unitario)
    costo = q4(costo_unitario if costo_unitario is not None else producto.costo_promedio)
    st.cantidad = nuevo
    st.updated_at = datetime.now(timezone.utc)
    row = Kardex(almacen_id=almacen_id, producto_id=producto.id, tipo=tipo, cantidad=cantidad,
                 costo_unitario=costo, saldo_cantidad=nuevo,
                 saldo_valorizado=q4(nuevo * D(producto.costo_promedio)),
                 compra_id=compra_id, venta_id=venta_id, motivo=motivo, usuario_id=user_id)
    db.add(row)
    return row


def purchase_entry(db: Session, user: Usuario, data) -> Compra:
    """Ingreso de una orden de compra al kardex. NO hace commit: el endpoint controla commit/rollback."""
    compra = db.execute(select(Compra).where(Compra.id == data.compra_id).with_for_update()).scalar_one_or_none()
    if not compra:
        raise HTTPException(404, "Orden de compra no encontrada")
    if compra.estado == Estado.INGRESADO:
        raise HTTPException(409, "La orden ya fue ingresada al kardex")
    if compra.estado not in (Estado.EMITIDO, Estado.APROBADO):
        raise HTTPException(409, f"Solo las órdenes EMITIDAS pueden ingresar al kardex (estado actual: {compra.estado})")
    serie, numero = data.serie.strip().upper(), data.numero.strip()
    dup = db.scalar(select(Compra.id).where(Compra.proveedor_id == compra.proveedor_id,
                                            Compra.serie_comprobante == serie,
                                            Compra.numero_comprobante == numero, Compra.id != compra.id))
    if dup:
        raise HTTPException(409, f"El comprobante {serie}-{numero} ya fue registrado para este proveedor")

    fecha_ing = data.fecha_ingreso or datetime.now(timezone.utc)
    for det in compra.detalles:
        costo = to_base(db, compra.moneda_id, fecha_ing.date(), det.precio_unitario)
        apply_movement(db, user.id, almacen_id=compra.almacen_id, producto=det.producto, tipo="ENTRADA",
                       cantidad=D(det.cantidad), costo_unitario=costo, compra_id=compra.id)

    compra.estado = Estado.INGRESADO
    compra.tipo_comprobante, compra.serie_comprobante, compra.numero_comprobante = data.tipo_comprobante, serie, numero
    compra.fecha_ingreso = fecha_ing
    if data.observaciones:
        compra.observaciones = data.observaciones[:300]

    dias = compra.forma_pago.dias_credito if compra.forma_pago else 0
    db.add(CuentaPorPagar(compra_id=compra.id, proveedor_id=compra.proveedor_id, monto_original=compra.total,
                          saldo=compra.total, vencimiento=fecha_ing.date() + timedelta(days=dias)))
    audit_service.log(db, user.id, "KARDEX_ENTRY", "inventario", f"compras:{compra.id}",
                      detalle={"orden": compra.numero_oc, "comprobante": f"{serie}-{numero}",
                               "lineas": len(compra.detalles)})
    db.flush()
    return compra
