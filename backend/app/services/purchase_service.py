import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (Almacen, Compra, DetalleCompra, Estado, FormaPago, Moneda, Proveedor, Usuario)
from app.services import audit_service
from app.services.pricing import calc_lines


def _get_or_422(db, model, id_, label):
    obj = db.get(model, id_)
    if not obj:
        raise HTTPException(422, f"{label} no encontrado")
    return obj


def create_purchase(db: Session, user: Usuario, data) -> Compra:
    _get_or_422(db, Proveedor, data.proveedor_id, "Proveedor")
    _get_or_422(db, Almacen, data.almacen_id, "Almacén")
    _get_or_422(db, Moneda, data.moneda_id, "Moneda")
    if data.forma_pago_id:
        _get_or_422(db, FormaPago, data.forma_pago_id, "Forma de pago")
    lineas, sub, imp, total = calc_lines(db, data.lineas)
    c = Compra(empresa_id=user.empresa_id, numero_oc=f"TMP-{uuid.uuid4().hex[:14]}",
               proveedor_id=data.proveedor_id, almacen_id=data.almacen_id, moneda_id=data.moneda_id,
               forma_pago_id=data.forma_pago_id, subtotal=sub, impuesto=imp, total=total,
               estado=Estado.EMITIDO if data.emitir else Estado.BORRADOR, usuario_id=user.id,
               observaciones=data.observaciones,
               detalles=[DetalleCompra(**{k: v for k, v in l.items() if k != "descuento"}) for l in lineas])
    if data.fecha:
        c.fecha = data.fecha
    db.add(c)
    db.flush()
    c.numero_oc = f"OC-{c.id:06d}"
    audit_service.log(db, user.id, "INSERT", "compras", f"compras:{c.id}",
                      detalle={"numero": c.numero_oc, "total": float(total), "estado": c.estado})
    return c


def change_state(db: Session, user: Usuario, compra_id: int, action: str) -> Compra:
    c = db.execute(select(Compra).where(Compra.id == compra_id).with_for_update()).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Orden de compra no encontrada")
    if action == "emitir":
        if c.estado != Estado.BORRADOR:
            raise HTTPException(409, "Solo se pueden emitir órdenes en BORRADOR")
        c.estado = Estado.EMITIDO
    elif action == "anular":
        if c.estado == Estado.INGRESADO:
            raise HTTPException(409, "No se puede anular una orden ya ingresada al kardex")
        if c.estado == Estado.ANULADO:
            raise HTTPException(409, "La orden ya está anulada")
        c.estado = Estado.ANULADO
    audit_service.log(db, user.id, action.upper(), "compras", f"compras:{c.id}", detalle={"numero": c.numero_oc})
    return c


def compra_out(c: Compra, detail: bool = True) -> dict:
    d = dict(id=c.id, numero_oc=c.numero_oc, fecha=c.fecha, estado=c.estado, proveedor_id=c.proveedor_id,
             proveedor=c.proveedor.razon_social, ruc=c.proveedor.ruc, almacen_id=c.almacen_id,
             almacen=c.almacen.nombre, moneda_id=c.moneda_id, moneda=c.moneda.codigo, subtotal=c.subtotal,
             impuesto=c.impuesto, total=c.total, tipo_comprobante=c.tipo_comprobante,
             serie_comprobante=c.serie_comprobante, numero_comprobante=c.numero_comprobante,
             fecha_ingreso=c.fecha_ingreso, observaciones=c.observaciones)
    if detail:
        d["lineas"] = [dict(id=l.id, producto_id=l.producto_id, sku=l.producto.sku, producto=l.producto.nombre,
                            cantidad=l.cantidad, precio_unitario=l.precio_unitario, subtotal=l.subtotal)
                       for l in c.detalles]
    return d
