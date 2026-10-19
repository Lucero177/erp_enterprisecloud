import pytest


def first(client, h, slug):
    return client.get(f"/api/v1/{slug}", headers=h).json()["items"][0]


@pytest.fixture(scope="module")
def ids(client, admin):
    return dict(prov=first(client, admin, "proveedores")["id"], cli=first(client, admin, "clientes")["id"],
                alm=first(client, admin, "almacenes")["id"], pen=client.get("/api/v1/monedas", headers=admin).json()["items"][0]["id"],
                prods=[p["id"] for p in client.get("/api/v1/productos", headers=admin).json()["items"]],
                credito=[f for f in client.get("/api/v1/formas-pago", headers=admin).json()["items"] if f["dias_credito"] == 30][0]["id"])


def stock_of(client, h, pid):
    rows = [r for r in client.get("/api/v1/inventory/stock", headers=h).json() if r["producto_id"] == pid]
    return float(rows[0]["cantidad"]) if rows else 0.0


def test_auth_required_and_login_fail(client):
    assert client.get("/api/v1/purchases").status_code == 401
    assert client.post("/api/v1/auth/login", data={"username": "admin", "password": "x"}).status_code == 401


def test_purchase_calculation_and_kardex_entry_atomic(client, admin, ids):
    p1, p2 = ids["prods"][:2]
    body = dict(proveedor_id=ids["prov"], almacen_id=ids["alm"], moneda_id=ids["pen"], forma_pago_id=ids["credito"],
                emitir=True, lineas=[dict(producto_id=p1, cantidad=10, precio_unitario=100),
                                     dict(producto_id=p2, cantidad=4, precio_unitario=50.5)])
    r = client.post("/api/v1/purchases", json=body, headers=admin)
    assert r.status_code == 201, r.text
    oc = r.json()
    assert oc["subtotal"] == 1202.0 and oc["impuesto"] == 216.36 and oc["total"] == 1418.36
    assert oc["estado"] == "EMITIDO" and oc["numero_oc"].startswith("OC-")

    # un borrador no puede ingresar
    b = client.post("/api/v1/purchases", json={**body, "emitir": False}, headers=admin).json()
    r = client.post("/api/v1/inventory/kardex-entry", headers=admin,
                    json=dict(compra_id=b["id"], tipo_comprobante="FACTURA", serie="F001", numero="1"))
    assert r.status_code == 409

    # ingreso correcto
    entry = dict(compra_id=oc["id"], tipo_comprobante="FACTURA", serie="f001", numero="000123")
    r = client.post("/api/v1/inventory/kardex-entry", json=entry, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "INGRESADO_CERRADO" and r.json()["serie_comprobante"] == "F001"
    assert stock_of(client, admin, p1) == 10 and stock_of(client, admin, p2) == 4
    k = client.get(f"/api/v1/inventory/kardex?producto_id={p1}", headers=admin).json()["items"]
    assert k[0]["tipo"] == "ENTRADA" and k[0]["saldo_cantidad"] == 10 and k[0]["saldo_valorizado"] == 1000.0

    # doble ingreso rechazado y sin efecto sobre stock
    assert client.post("/api/v1/inventory/kardex-entry", json=entry, headers=admin).status_code == 409
    assert stock_of(client, admin, p1) == 10

    # comprobante duplicado para el mismo proveedor
    o2 = client.post("/api/v1/purchases", json=body, headers=admin).json()
    dup = client.post("/api/v1/inventory/kardex-entry", headers=admin, json={**entry, "compra_id": o2["id"]})
    assert dup.status_code == 409 and "ya fue registrado" in dup.json()["detail"]
    assert stock_of(client, admin, p1) == 10

    # no se anula una orden ya ingresada; sí una emitida
    assert client.post(f"/api/v1/purchases/{oc['id']}/anular", headers=admin).status_code == 409
    assert client.post(f"/api/v1/purchases/{o2['id']}/anular", headers=admin).json()["estado"] == "ANULADO"

    # nació la cuenta por pagar a 30 días
    cxp = client.get("/api/v1/treasury/cxp", headers=admin).json()["items"]
    assert any(c["referencia"] == oc["numero_oc"] and c["saldo"] == 1418.36 for c in cxp)


def test_sales_flow_stock_credit_and_reversal(client, admin, ids):
    p1 = ids["prods"][0]
    cot = client.post("/api/v1/sales/cotizaciones", headers=admin, json=dict(
        cliente_id=ids["cli"], moneda_id=ids["pen"], lineas=[dict(producto_id=p1, cantidad=3, precio_unitario=150)]))
    assert cot.status_code == 201 and cot.json()["total"] == 531.0
    ov = client.post(f"/api/v1/sales/cotizaciones/{cot.json()['id']}/convertir", json={"almacen_id": ids["alm"]}, headers=admin)
    assert ov.status_code == 201 and ov.json()["estado"] == "EMITIDO"
    vid = ov.json()["id"]
    assert client.post(f"/api/v1/sales/cotizaciones/{cot.json()['id']}/convertir", json={"almacen_id": ids["alm"]}, headers=admin).status_code == 409

    before = stock_of(client, admin, p1)
    f = client.post(f"/api/v1/sales/ordenes/{vid}/facturar", json={"tipo_comprobante": "FACTURA"}, headers=admin)
    assert f.status_code == 200, f.text
    assert f.json()["numero_comprobante"] == "00000001" and f.json()["serie_comprobante"] == "F001"
    assert stock_of(client, admin, p1) == before - 3
    assert client.post(f"/api/v1/sales/ordenes/{vid}/facturar", json={}, headers=admin).status_code == 409

    ec = client.get(f"/api/v1/sales/estado-cuenta/{ids['cli']}", headers=admin).json()
    assert ec["saldo_pendiente"] == 531.0

    # cobro parcial + exceso rechazado
    cxc = client.get("/api/v1/treasury/cxc", headers=admin).json()["items"][0]
    assert client.post(f"/api/v1/treasury/cxc/{cxc['id']}/cobrar", json={"monto": 1000}, headers=admin).status_code == 422
    r = client.post(f"/api/v1/treasury/cxc/{cxc['id']}/cobrar", json={"monto": 31}, headers=admin)
    assert r.json()["saldo"] == 500.0 and r.json()["estado"] == "PARCIAL"
    # con cobros no se puede anular el comprobante
    assert client.post(f"/api/v1/sales/ordenes/{vid}/anular", json={}, headers=admin).status_code == 409
    caja = client.get("/api/v1/treasury/caja/resumen", headers=admin).json()
    assert caja[0]["ingresos"] == 31.0

    # sin stock suficiente: 409 y nada cambia
    big = client.post("/api/v1/sales/ordenes", headers=admin, json=dict(
        cliente_id=ids["cli"], almacen_id=ids["alm"], moneda_id=ids["pen"],
        lineas=[dict(producto_id=p1, cantidad=9999, precio_unitario=1)])).json()
    s0 = stock_of(client, admin, p1)
    r = client.post(f"/api/v1/sales/ordenes/{big['id']}/facturar", json={}, headers=admin)
    assert r.status_code == 409 and "Stock insuficiente" in r.json()["detail"]
    assert stock_of(client, admin, p1) == s0
    assert client.get(f"/api/v1/sales/ordenes/{big['id']}", headers=admin).json()["estado"] == "EMITIDO"

    # anulación de comprobante sin cobros repone stock y cancela CxC
    o = client.post("/api/v1/sales/ordenes", headers=admin, json=dict(
        cliente_id=ids["cli"], almacen_id=ids["alm"], moneda_id=ids["pen"],
        lineas=[dict(producto_id=p1, cantidad=2, precio_unitario=10)])).json()
    client.post(f"/api/v1/sales/ordenes/{o['id']}/facturar", json={}, headers=admin)
    assert stock_of(client, admin, p1) == s0 - 2
    assert client.post(f"/api/v1/sales/ordenes/{o['id']}/anular", json={"motivo": "error"}, headers=admin).json()["estado"] == "ANULADO"
    assert stock_of(client, admin, p1) == s0


def test_masters_crud_and_dashboard(client, admin):
    r = client.post("/api/v1/marcas", json={"nombre": "Acme"}, headers=admin)
    assert r.status_code == 201
    assert client.post("/api/v1/marcas", json={"nombre": "Acme"}, headers=admin).status_code == 409
    mid = r.json()["id"]
    assert client.put(f"/api/v1/marcas/{mid}", json={"nombre": "Acme 2"}, headers=admin).json()["nombre"] == "Acme 2"
    assert client.delete(f"/api/v1/marcas/{mid}", headers=admin).status_code == 200
    d = client.get("/api/v1/dashboard", headers=admin).json()
    assert d["kpis"]["compras_mes"] > 0 and d["kpis"]["ventas_mes"] > 0 and len(d["serie"]) == 6
    assert d["kpis"]["inventario_valorizado"] > 0


def test_rbac_denied_is_audited(client, admin):
    roles = {r["nombre"]: r["id"] for r in client.get("/api/v1/users/roles", headers=admin).json()}
    u = client.post("/api/v1/users", headers=admin, json=dict(username="vend1", email="v@x.com", nombre_completo="Vendedor Uno",
                                                              password="Secreta123", rol_id=roles["VENTAS"]))
    assert u.status_code == 201
    assert client.post("/api/v1/users", headers=admin, json=dict(username="vend1", email="o@x.com", nombre_completo="Otro Uno",
                                                                 password="Secreta123", rol_id=roles["VENTAS"])).status_code == 409
    tok = client.post("/api/v1/auth/login", data={"username": "vend1", "password": "Secreta123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/v1/sales/ordenes", headers=h).status_code == 200
    assert client.get("/api/v1/purchases", headers=h).status_code == 403
    assert client.get("/api/v1/audit", headers=h).status_code == 403
    assert client.post("/api/v1/inventory/kardex-entry", headers=h, json=dict(compra_id=1, tipo_comprobante="FACTURA", serie="F", numero="1")).status_code == 403
    logs = client.get("/api/v1/audit?resultado=DENEGADO", headers=admin).json()
    assert logs["total"] >= 3
    acciones = {a["accion"] for a in client.get("/api/v1/audit?limit=500", headers=admin).json()["items"]}
    assert {"INSERT", "KARDEX_ENTRY", "FACTURAR", "LOGIN", "ANULAR"} <= acciones


def test_documents_presign_s3(client, admin, ids):
    c = client.get("/api/v1/purchases", headers=admin).json()["items"][0]
    r = client.post("/api/v1/documents/presign", headers=admin, json=dict(
        entidad="compra", entidad_id=c["id"], nombre="factura prov.pdf", mime_type="application/pdf", tamano_bytes=1234))
    assert r.status_code == 201, r.text
    assert "X-Amz-Signature" in r.json()["upload_url"] and r.json()["method"] == "PUT"
    docs = client.get(f"/api/v1/documents?entidad=compra&entidad_id={c['id']}", headers=admin).json()
    assert len(docs) == 1
    assert "X-Amz-Signature" in client.get(f"/api/v1/documents/{docs[0]['id']}/download-url", headers=admin).json()["url"]
    bad = client.post("/api/v1/documents/presign", headers=admin, json=dict(
        entidad="compra", entidad_id=c["id"], nombre="a.exe", mime_type="application/x-msdownload", tamano_bytes=10))
    assert bad.status_code == 422
    assert client.post("/api/v1/documents/presign", headers=admin, json=dict(
        entidad="compra", entidad_id=99999, nombre="a.pdf", mime_type="application/pdf", tamano_bytes=10)).status_code == 404
