"""Crea tablas (si no existen) y carga datos iniciales. Idempotente.
Uso:  python -m scripts.seed            (usuario: admin / Admin123!)
"""
import os
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal, engine
from app.models import (Almacen, Base, Categoria, Cliente, FormaPago, Impuesto, Marca, Moneda, Empresa, Permiso,
                        Producto, Proveedor, Rol, Sucursal, TipoCambio, UnidadMedida, Usuario, Vendedor, Zona)
from app.security.hashing import hash_password

MODULOS = ["dashboard", "maestros", "compras", "inventario", "ventas", "tesoreria", "documentos", "seguridad", "auditoria"]
ACCIONES = ["read", "create", "update", "delete", "approve"]


def _all(mods, acts=ACCIONES):
    return [(m, a) for m in mods for a in acts]


ROLES = {
    "ADMIN": ("Administrador total", _all(MODULOS)),
    "COMPRAS": ("Compras y abastecimiento", [("dashboard", "read"), ("maestros", "read"), ("inventario", "read")]
                + _all(["compras", "documentos"], ["read", "create", "update", "approve"])),
    "ALMACEN": ("Almacén e inventario", [("dashboard", "read"), ("maestros", "read"), ("compras", "read"),
                                         ("compras", "approve"), ("ventas", "read")] + _all(["inventario"], ["read", "create"])),
    "VENTAS": ("Comercial y facturación", [("dashboard", "read"), ("maestros", "read"), ("inventario", "read"),
                                           ("tesoreria", "read")] + _all(["ventas", "documentos"], ["read", "create", "update", "approve"])),
    "TESORERIA": ("Tesorería y finanzas", [("dashboard", "read"), ("maestros", "read"), ("compras", "read"),
                                           ("ventas", "read")] + _all(["tesoreria"], ["read", "create", "update"])),
    "AUDITOR": ("Solo lectura y auditoría", [(m, "read") for m in MODULOS]),
}


def seed(db) -> None:
    perms = {}
    for m, a in _all(MODULOS):
        p = db.scalar(select(Permiso).where(Permiso.modulo == m, Permiso.accion == a))
        if not p:
            p = Permiso(modulo=m, accion=a)
            db.add(p)
        perms[(m, a)] = p
    db.flush()
    for nombre, (desc, plist) in ROLES.items():
        if not db.scalar(select(Rol).where(Rol.nombre == nombre)):
            db.add(Rol(nombre=nombre, descripcion=desc, permisos=[perms[x] for x in plist]))
    db.flush()

    if db.scalar(select(Empresa).limit(1)):
        db.commit()
        return
    emp = Empresa(ruc="20123456789", razon_social="Mi Empresa S.A.C.", direccion="Lima, Perú")
    db.add(emp)
    db.flush()
    suc = Sucursal(empresa_id=emp.id, nombre="Sede Central")
    db.add(suc)
    db.flush()
    db.add(Almacen(sucursal_id=suc.id, codigo="ALM-01", nombre="Almacén Principal"))
    pen, usd = Moneda(codigo="PEN", nombre="Sol", simbolo="S/"), Moneda(codigo="USD", nombre="Dólar", simbolo="$")
    db.add_all([pen, usd, Impuesto(codigo="IGV", nombre="Impuesto General a las Ventas", porcentaje=18),
                FormaPago(nombre="Contado", dias_credito=0), FormaPago(nombre="Crédito 15 días", dias_credito=15),
                FormaPago(nombre="Crédito 30 días", dias_credito=30)])
    und, cja = UnidadMedida(codigo="UND", nombre="Unidad"), UnidadMedida(codigo="CJA", nombre="Caja")
    z = Zona(nombre="Lima")
    db.add_all([und, cja, z, Marca(nombre="Genérica"), Categoria(nombre="General")])
    db.flush()
    db.add(TipoCambio(moneda_id=usd.id, fecha=date.today(), compra=3.70, venta=3.75))
    igv = db.scalar(select(Impuesto).where(Impuesto.codigo == "IGV"))
    db.add(Vendedor(nombre="Vendedor Demo", zona_id=z.id))
    db.add(Cliente(empresa_id=emp.id, documento="20987654321", razon_social="Cliente Demo S.A.", zona_id=z.id,
                   limite_credito=0))
    db.add(Proveedor(empresa_id=emp.id, ruc="20555666777", razon_social="Proveedor Demo S.R.L."))
    for sku, nom, minimo in [("PRD-001", "Producto de ejemplo A", 10), ("PRD-002", "Producto de ejemplo B", 5)]:
        db.add(Producto(empresa_id=emp.id, sku=sku, nombre=nom, unidad_id=und.id, impuesto_id=igv.id,
                        stock_minimo=minimo))
    rol_admin = db.scalar(select(Rol).where(Rol.nombre == "ADMIN"))
    db.add(Usuario(empresa_id=emp.id, rol_id=rol_admin.id, username="admin", email="admin@empresa.com",
                   nombre_completo="Administrador del Sistema",
                   password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "Admin123!"))))
    db.commit()


if __name__ == "__main__":
    Base.metadata.create_all(engine)
    with SessionLocal() as s:
        seed(s)
    print("Base de datos lista. Usuario inicial: admin")
