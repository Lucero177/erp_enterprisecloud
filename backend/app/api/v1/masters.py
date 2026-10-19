from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.crud_factory import crud_router
from app.core.database import get_db
from app.models import (Almacen, Categoria, Cliente, ConversionUnidad, Empresa, FormaPago, Impuesto, ListaPrecios,
                        ListaPreciosDetalle, Marca, Moneda, Producto, Proveedor, Sucursal, TipoCambio,
                        Transportista, UnidadMedida, Vendedor, Zona)
from app.security.rbac import require_permission
from app.services import audit_service

router = APIRouter()

MASTERS = [
    (Empresa, "empresas", "Empresa", ("ruc", "razon_social")),
    (Sucursal, "sucursales", "Sucursal", ("nombre",)),
    (Almacen, "almacenes", "Almacén", ("codigo", "nombre")),
    (Cliente, "clientes", "Cliente", ("documento", "razon_social")),
    (Proveedor, "proveedores", "Proveedor", ("ruc", "razon_social")),
    (Transportista, "transportistas", "Transportista", ("ruc", "razon_social")),
    (Vendedor, "vendedores", "Vendedor", ("nombre",)),
    (Zona, "zonas", "Zona", ("nombre",)),
    (Producto, "productos", "Producto", ("sku", "nombre")),
    (Categoria, "categorias", "Categoría", ("nombre",)),
    (Marca, "marcas", "Marca", ("nombre",)),
    (UnidadMedida, "unidades-medida", "Unidad de medida", ("codigo", "nombre")),
    (ConversionUnidad, "conversion-unidades", "Conversión de unidades", ()),
    (Moneda, "monedas", "Moneda", ("codigo", "nombre")),
    (TipoCambio, "tipos-cambio", "Tipo de cambio", ()),
    (Impuesto, "impuestos", "Impuesto", ("codigo", "nombre")),
    (FormaPago, "formas-pago", "Forma de pago", ("nombre",)),
    (ListaPrecios, "listas-precios", "Lista de precios", ("nombre",)),
]
for model, slug, label, search in MASTERS:
    router.include_router(crud_router(model, slug, label, search))


class PrecioIn(BaseModel):
    producto_id: int
    precio: float = Field(ge=0)


@router.get("/listas-precios/{lista_id}/detalle", tags=["Maestros · Lista de precios"])
def get_precios(lista_id: int, db: Session = Depends(get_db), user=Depends(require_permission("maestros", "read"))):
    rows = db.execute(select(ListaPreciosDetalle, Producto).join(Producto, Producto.id == ListaPreciosDetalle.producto_id)
                      .where(ListaPreciosDetalle.lista_id == lista_id).order_by(Producto.nombre)).all()
    return [dict(producto_id=p.id, sku=p.sku, producto=p.nombre, precio=d.precio) for d, p in rows]


@router.put("/listas-precios/{lista_id}/detalle", tags=["Maestros · Lista de precios"])
def set_precios(lista_id: int, items: list[PrecioIn], db: Session = Depends(get_db),
                user=Depends(require_permission("maestros", "update"))):
    if not db.get(ListaPrecios, lista_id):
        raise HTTPException(404, "Lista de precios no encontrada")
    db.execute(delete(ListaPreciosDetalle).where(ListaPreciosDetalle.lista_id == lista_id))
    for it in items:
        db.add(ListaPreciosDetalle(lista_id=lista_id, producto_id=it.producto_id, precio=it.precio))
    audit_service.log(db, user.id, "UPDATE", "maestros:listas-precios", f"listas_precios:{lista_id}",
                      detalle={"items": len(items)})
    db.commit()
    return {"ok": True, "items": len(items)}
