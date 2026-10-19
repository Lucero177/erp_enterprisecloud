from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (Almacen, Cliente, Cotizacion, CuentaPorCobrar, DetalleCotizacion, DetalleVenta, Estado,
                        Kardex, Moneda, Usuario, Venta)
from app.services import audit_service
from app.services.kardex_service import apply_movement
from app.services.pricing import D, calc_lines
import uuid


def _need(db, model, id_, label):
    o = db.get(model, id_)
    if not o:
        raise HTTPException(422, f"{label} no encontrado")
    return o


# ------------------------------------------------------------ cotizaciones
def create_cotizacion(db: Session, user: Usuario, data) -> Cotizacion:
    cli = _need(db, Cliente, data.cliente_id, "Cliente")
    _need(db, Moneda, data.moneda_id, "Moneda")
    lineas, sub, imp, total = calc_lines(db, data.lineas)
    c = Cotizacion(empresa_id=user.empresa_id, numero=f"TMP-{uuid.uuid4().hex[:14]}", cliente_id=cli.id,
                   vendedor_id=data.vendedor_id or cli.vendedor_id, moneda_id=data.moneda_id,
                   vigencia_hasta=data.vigencia_hasta, subtotal=sub, impuesto=imp, total=total,
                   estado=Estado.EMITIDO if data.emitir else Estado.BORRADOR, usuario_id=user.id,
                   detalles=[DetalleCotizacion(**l) for l in lineas])
    db.add(c)
    db.flush()
    c.numero = f"COT-{c.id:06d}"
    audit_service.log(db, user.id, "INSERT", "ventas", f"cotizaciones:{c.id}", detalle={"total": float(total)})
    return c


def convertir_cotizacion(db: Session, user: Usuario, cot_id: int, almacen_id: int) -> Venta:
    cot = db.execute(select(Cotizacion).where(Cotizacion.id == cot_id).with_for_update()).scalar_one_or_none()
    if not cot:
        raise HTTPException(404, "Cotización no encontrada")
    if cot.estado != Estado.EMITIDO:
        raise HTTPException(409, f"Solo se convierten cotizaciones EMITIDAS (estado actual: {cot.estado})")
    if cot.vigencia_hasta and cot.vigencia_hasta < date.today():
        raise HTTPException(409, "La cotización está vencida")
    _need(db, Almacen, almacen_id, "Almacén")
    cli = cot.cliente
    v = Venta(empresa_id=user.empresa_id, cotizacion_id=cot.id, numero_ov=f"TMP-{uuid.uuid4().hex[:14]}",
              cliente_id=cot.cliente_id, vendedor_id=cot.vendedor_id, almacen_id=almacen_id,
              moneda_id=cot.moneda_id, forma_pago_id=cli.forma_pago_id, subtotal=cot.subtotal,
              impuesto=cot.impuesto, total=cot.total, estado=Estado.EMITIDO, usuario_id=user.id,
              detalles=[DetalleVenta(producto_id=d.producto_id, cantidad=d.cantidad,
                                     precio_unitario=d.precio_unitario, descuento=d.descuento,
                                     subtotal=d.subtotal) for d in cot.detalles])
    db.add(v)
    db.flush()
    v.numero_ov = f"OV-{v.id:06d}"
    cot.estado = Estado.APROBADO
    audit_service.log(db, user.id, "CONVERTIR", "ventas", f"cotizaciones:{cot.id}", detalle={"orden": v.numero_ov})
    return v


# ------------------------------------------------------------ órdenes de venta
def create_orden(db: Session, user: Usuario, data) -> Venta:
    cli = _need(db, Cliente, data.cliente_id, "Cliente")
    _need(db, Almacen, data.almacen_id, "Almacén")
    _need(db, Moneda, data.moneda_id, "Moneda")
    lineas, sub, imp, total = calc_lines(db, data.lineas)
    v = Venta(empresa_id=user.empresa_id, numero_ov=f"TMP-{uuid.uuid4().hex[:14]}", cliente_id=cli.id,
              vendedor_id=data.vendedor_id or cli.vendedor_id, almacen_id=data.almacen_id,
              transportista_id=data.transportista_id, moneda_id=data.moneda_id,
              forma_pago_id=data.forma_pago_id or cli.forma_pago_id, subtotal=sub, impuesto=imp, total=total,
              estado=Estado.EMITIDO if data.emitir else Estado.BORRADOR, usuario_id=user.id,
              detalles=[DetalleVenta(**l) for l in lineas])
    db.add(v)
    db.flush()
    v.numero_ov = f"OV-{v.id:06d}"
    audit_service.log(db, user.id, "INSERT", "ventas", f"ventas:{v.id}", detalle={"total": float(total)})
    return v


def facturar(db: Session, user: Usuario, venta_id: int, tipo: str, serie: str | None) -> Venta:
    v = db.execute(select(Venta).where(Venta.id == venta_id).with_for_update()).scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Orden de venta no encontrada")
    if v.estado == Estado.FACTURADO:
        raise HTTPException(409, "La orden ya fue facturada")
    if v.estado != Estado.EMITIDO:
        raise HTTPException(409, f"Solo se facturan órdenes EMITIDAS (estado actual: {v.estado})")
    cli = v.cliente
    if D(cli.limite_credito) > 0:
        pendiente = D(db.scalar(select(func.coalesce(func.sum(CuentaPorCobrar.saldo), 0))
                                .where(CuentaPorCobrar.cliente_id == cli.id,
                                       CuentaPorCobrar.estado.in_(["PENDIENTE", "PARCIAL"]))))
        if pendiente + D(v.total) > D(cli.limite_credito):
            raise HTTPException(409, f"Supera el límite de crédito del cliente (límite {cli.limite_credito}, "
                                     f"pendiente {pendiente}, esta venta {v.total})")
    serie = (serie or ("F001" if tipo == "FACTURA" else "B001")).strip().upper()
    ultimo = db.scalar(select(func.max(Venta.numero_comprobante))
                       .where(Venta.tipo_comprobante == tipo, Venta.serie_comprobante == serie))
    numero = f"{(int(ultimo) + 1) if ultimo else 1:08d}"

    for det in v.detalles:   # salida de kardex a costo promedio (falla con 409 si no hay stock)
        apply_movement(db, user.id, almacen_id=v.almacen_id, producto=det.producto, tipo="SALIDA",
                       cantidad=-D(det.cantidad), venta_id=v.id)
    v.estado = Estado.FACTURADO
    v.tipo_comprobante, v.serie_comprobante, v.numero_comprobante = tipo, serie, numero
    v.fecha_emision = datetime.now(timezone.utc)
    dias = v.forma_pago.dias_credito if v.forma_pago else 0
    db.add(CuentaPorCobrar(venta_id=v.id, cliente_id=v.cliente_id, monto_original=v.total, saldo=v.total,
                           vencimiento=date.today() + timedelta(days=dias)))
    audit_service.log(db, user.id, "FACTURAR", "ventas", f"ventas:{v.id}",
                      detalle={"comprobante": f"{serie}-{numero}", "total": float(v.total)})
    db.flush()
    return v


def anular_venta(db: Session, user: Usuario, venta_id: int, motivo: str | None) -> Venta:
    v = db.execute(select(Venta).where(Venta.id == venta_id).with_for_update()).scalar_one_or_none()
    if not v:
        raise HTTPException(404, "Orden de venta no encontrada")
    if v.estado == Estado.ANULADO:
        raise HTTPException(409, "La orden ya está anulada")
    if v.estado == Estado.FACTURADO:
        cxc = db.scalar(select(CuentaPorCobrar).where(CuentaPorCobrar.venta_id == v.id).with_for_update())
        if cxc and D(cxc.saldo) != D(cxc.monto_original):
            raise HTTPException(409, "El comprobante tiene cobros registrados; no puede anularse")
        for det in v.detalles:   # reversa de kardex al mismo costo de la salida
            salida = db.scalar(select(Kardex).where(Kardex.venta_id == v.id, Kardex.producto_id == det.producto_id,
                                                    Kardex.tipo == "SALIDA").order_by(Kardex.id.desc()).limit(1))
            apply_movement(db, user.id, almacen_id=v.almacen_id, producto=det.producto, tipo="ENTRADA",
                           cantidad=D(det.cantidad), costo_unitario=salida.costo_unitario if salida else None,
                           venta_id=v.id, motivo="Anulación de comprobante")
        if cxc:
            cxc.estado, cxc.saldo = "ANULADO", Decimal(0)
    v.estado = Estado.ANULADO
    audit_service.log(db, user.id, "ANULAR", "ventas", f"ventas:{v.id}", detalle={"motivo": motivo})
    return v


def venta_out(v: Venta, detail: bool = True) -> dict:
    d = dict(id=v.id, numero_ov=v.numero_ov, fecha=v.fecha, estado=v.estado, cliente_id=v.cliente_id,
             cliente=v.cliente.razon_social, documento=v.cliente.documento, almacen_id=v.almacen_id,
             almacen=v.almacen.nombre, moneda_id=v.moneda_id, moneda=v.moneda.codigo, subtotal=v.subtotal,
             impuesto=v.impuesto, total=v.total, tipo_comprobante=v.tipo_comprobante,
             serie_comprobante=v.serie_comprobante, numero_comprobante=v.numero_comprobante,
             fecha_emision=v.fecha_emision, cotizacion_id=v.cotizacion_id)
    if detail:
        d["lineas"] = [dict(id=l.id, producto_id=l.producto_id, sku=l.producto.sku, producto=l.producto.nombre,
                            cantidad=l.cantidad, precio_unitario=l.precio_unitario, descuento=l.descuento,
                            subtotal=l.subtotal) for l in v.detalles]
    return d


def cotizacion_out(c: Cotizacion, detail: bool = True) -> dict:
    d = dict(id=c.id, numero=c.numero, fecha=c.fecha, vigencia_hasta=c.vigencia_hasta, estado=c.estado,
             cliente_id=c.cliente_id, cliente=c.cliente.razon_social, moneda_id=c.moneda_id,
             moneda=c.moneda.codigo, subtotal=c.subtotal, impuesto=c.impuesto, total=c.total)
    if detail:
        d["lineas"] = [dict(id=l.id, producto_id=l.producto_id, sku=l.producto.sku, producto=l.producto.nombre,
                            cantidad=l.cantidad, precio_unitario=l.precio_unitario, descuento=l.descuento,
                            subtotal=l.subtotal) for l in c.detalles]
    return d
