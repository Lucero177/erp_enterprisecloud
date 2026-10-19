-- =====================================================================
-- ERP EnterpriseCloud | Esquema de REFERENCIA PostgreSQL 15+ (RDS ready)
-- La app crea sus tablas desde los modelos SQLAlchemy (scripts/seed.py o Alembic).
-- Este DDL documenta el modelo; los estados/tipos son ENUM aquí y VARCHAR en la app.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Tipos enumerados ----------
CREATE TYPE estado_documento AS ENUM ('BORRADOR','EMITIDO','APROBADO','FACTURADO','INGRESADO_CERRADO','ANULADO');
CREATE TYPE tipo_movimiento  AS ENUM ('ENTRADA','SALIDA','AJUSTE','TRANSFERENCIA');
CREATE TYPE tipo_comprobante AS ENUM ('FACTURA','BOLETA','NOTA_CREDITO','NOTA_DEBITO','GUIA_REMISION');
CREATE TYPE resultado_audit  AS ENUM ('EXITO','FALLO','DENEGADO');

-- =====================================================================
-- 1. SEGURIDAD (RBAC)
-- =====================================================================
CREATE TABLE roles (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(50) UNIQUE NOT NULL,
  descripcion   VARCHAR(200),
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE permisos (
  id            SERIAL PRIMARY KEY,
  modulo        VARCHAR(50) NOT NULL,
  accion        VARCHAR(30) NOT NULL,          -- read, create, update, delete, approve
  UNIQUE (modulo, accion)
);

CREATE TABLE roles_permisos (
  rol_id        INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id    INT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

-- =====================================================================
-- 2. MAESTROS: ORGANIZACIÓN
-- =====================================================================
CREATE TABLE empresas (
  id            SERIAL PRIMARY KEY,
  ruc           VARCHAR(11) UNIQUE NOT NULL,
  razon_social  VARCHAR(200) NOT NULL,
  direccion     VARCHAR(250),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sucursales (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  nombre        VARCHAR(120) NOT NULL,
  direccion     VARCHAR(250),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (empresa_id, nombre)
);

CREATE TABLE almacenes (
  id            SERIAL PRIMARY KEY,
  sucursal_id   INT NOT NULL REFERENCES sucursales(id),
  codigo        VARCHAR(20) UNIQUE NOT NULL,
  nombre        VARCHAR(120) NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  rol_id        INT NOT NULL REFERENCES roles(id),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,         -- bcrypt
  nombre_completo VARCHAR(150) NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. MAESTROS: FINANZAS
-- =====================================================================
CREATE TABLE monedas (
  id            SERIAL PRIMARY KEY,
  codigo        CHAR(3) UNIQUE NOT NULL,       -- PEN, USD
  nombre        VARCHAR(50) NOT NULL,
  simbolo       VARCHAR(5)
);

CREATE TABLE tipos_cambio (
  id            SERIAL PRIMARY KEY,
  moneda_id     INT NOT NULL REFERENCES monedas(id),
  fecha         DATE NOT NULL,
  compra        NUMERIC(10,4) NOT NULL,
  venta         NUMERIC(10,4) NOT NULL,
  UNIQUE (moneda_id, fecha)
);

CREATE TABLE impuestos (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(10) UNIQUE NOT NULL,   -- IGV
  nombre        VARCHAR(50) NOT NULL,
  porcentaje    NUMERIC(5,2) NOT NULL DEFAULT 18.00
);

CREATE TABLE formas_pago (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(60) UNIQUE NOT NULL,
  dias_credito  INT NOT NULL DEFAULT 0
);

CREATE TABLE listas_precios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(80) NOT NULL,
  moneda_id     INT NOT NULL REFERENCES monedas(id),
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE,
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 4. MAESTROS: COMERCIAL
-- =====================================================================
CREATE TABLE zonas (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE vendedores (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(150),
  zona_id       INT REFERENCES zonas(id),
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE clientes (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  documento     VARCHAR(15) NOT NULL,          -- RUC / DNI
  razon_social  VARCHAR(200) NOT NULL,
  direccion     VARCHAR(250),
  email         VARCHAR(150),
  telefono      VARCHAR(30),
  zona_id       INT REFERENCES zonas(id),
  vendedor_id   INT REFERENCES vendedores(id),
  forma_pago_id INT REFERENCES formas_pago(id),
  lista_precios_id INT REFERENCES listas_precios(id),
  limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (empresa_id, documento)
);

CREATE TABLE proveedores (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  ruc           VARCHAR(11) NOT NULL,
  razon_social  VARCHAR(200) NOT NULL,
  direccion     VARCHAR(250),
  email         VARCHAR(150),
  telefono      VARCHAR(30),
  forma_pago_id INT REFERENCES formas_pago(id),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (empresa_id, ruc)
);

CREATE TABLE transportistas (
  id            SERIAL PRIMARY KEY,
  ruc           VARCHAR(11) UNIQUE NOT NULL,
  razon_social  VARCHAR(200) NOT NULL,
  telefono      VARCHAR(30),
  activo        BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 5. MAESTROS: INVENTARIO
-- =====================================================================
CREATE TABLE categorias (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) UNIQUE NOT NULL,
  padre_id      INT REFERENCES categorias(id)
);

CREATE TABLE marcas (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE unidades_medida (
  id            SERIAL PRIMARY KEY,
  codigo        VARCHAR(10) UNIQUE NOT NULL,   -- UND, CJA, KG
  nombre        VARCHAR(60) NOT NULL
);

CREATE TABLE conversion_unidades (
  id            SERIAL PRIMARY KEY,
  unidad_origen_id  INT NOT NULL REFERENCES unidades_medida(id),
  unidad_destino_id INT NOT NULL REFERENCES unidades_medida(id),
  factor        NUMERIC(14,6) NOT NULL CHECK (factor > 0),
  UNIQUE (unidad_origen_id, unidad_destino_id)
);

CREATE TABLE productos (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  sku           VARCHAR(40) NOT NULL,
  nombre        VARCHAR(200) NOT NULL,
  categoria_id  INT REFERENCES categorias(id),
  marca_id      INT REFERENCES marcas(id),
  unidad_id     INT NOT NULL REFERENCES unidades_medida(id),
  impuesto_id   INT REFERENCES impuestos(id),
  stock_minimo  NUMERIC(14,3) NOT NULL DEFAULT 0,
  costo_promedio NUMERIC(14,4) NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (empresa_id, sku)
);

CREATE TABLE listas_precios_detalle (
  lista_id      INT NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
  producto_id   INT NOT NULL REFERENCES productos(id),
  precio        NUMERIC(14,4) NOT NULL CHECK (precio >= 0),
  PRIMARY KEY (lista_id, producto_id)
);

-- Existencias por almacén (se actualiza SOLO desde el ingreso/salida de kardex)
CREATE TABLE stock_almacen (
  almacen_id    INT NOT NULL REFERENCES almacenes(id),
  producto_id   INT NOT NULL REFERENCES productos(id),
  cantidad      NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (almacen_id, producto_id)
);

-- =====================================================================
-- 6. COMPRAS
-- =====================================================================
CREATE TABLE compras (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  numero_oc     VARCHAR(20) UNIQUE NOT NULL,
  proveedor_id  INT NOT NULL REFERENCES proveedores(id),
  almacen_id    INT NOT NULL REFERENCES almacenes(id),   -- almacén receptor
  moneda_id     INT NOT NULL REFERENCES monedas(id),
  forma_pago_id INT REFERENCES formas_pago(id),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal      NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado        estado_documento NOT NULL DEFAULT 'BORRADOR',
  -- datos del comprobante al recepcionar
  tipo_comprobante tipo_comprobante,
  serie_comprobante VARCHAR(10),
  numero_comprobante VARCHAR(20),
  fecha_ingreso TIMESTAMPTZ,
  observaciones VARCHAR(300),
  usuario_id    INT NOT NULL REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, serie_comprobante, numero_comprobante)
);

CREATE TABLE detalle_compras (
  id            SERIAL PRIMARY KEY,
  compra_id     INT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id   INT NOT NULL REFERENCES productos(id),
  cantidad      NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,4) NOT NULL CHECK (precio_unitario >= 0),
  subtotal      NUMERIC(14,2) NOT NULL
);

-- =====================================================================
-- 7. VENTAS (Cotización -> Orden de Venta -> Facturación)
-- =====================================================================
CREATE TABLE cotizaciones (
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  numero        VARCHAR(20) UNIQUE NOT NULL,
  cliente_id    INT NOT NULL REFERENCES clientes(id),
  vendedor_id   INT REFERENCES vendedores(id),
  moneda_id     INT NOT NULL REFERENCES monedas(id),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta DATE,
  subtotal      NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado        estado_documento NOT NULL DEFAULT 'BORRADOR',
  usuario_id    INT NOT NULL REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE detalle_cotizaciones (
  id            SERIAL PRIMARY KEY,
  cotizacion_id INT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  producto_id   INT NOT NULL REFERENCES productos(id),
  cantidad      NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,4) NOT NULL CHECK (precio_unitario >= 0),
  descuento     NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(14,2) NOT NULL
);

CREATE TABLE ventas (                              -- Orden de venta / venta facturada
  id            SERIAL PRIMARY KEY,
  empresa_id    INT NOT NULL REFERENCES empresas(id),
  cotizacion_id INT REFERENCES cotizaciones(id),
  numero_ov     VARCHAR(20) UNIQUE NOT NULL,
  cliente_id    INT NOT NULL REFERENCES clientes(id),
  vendedor_id   INT REFERENCES vendedores(id),
  almacen_id    INT NOT NULL REFERENCES almacenes(id),
  transportista_id INT REFERENCES transportistas(id),
  moneda_id     INT NOT NULL REFERENCES monedas(id),
  forma_pago_id INT REFERENCES formas_pago(id),
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal      NUMERIC(14,2) NOT NULL DEFAULT 0,
  impuesto      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado        estado_documento NOT NULL DEFAULT 'BORRADOR',
  -- facturación
  tipo_comprobante tipo_comprobante,
  serie_comprobante VARCHAR(10),
  numero_comprobante VARCHAR(20),
  fecha_emision TIMESTAMPTZ,
  usuario_id    INT NOT NULL REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_comprobante, serie_comprobante, numero_comprobante)
);

CREATE TABLE detalle_ventas (
  id            SERIAL PRIMARY KEY,
  venta_id      INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id   INT NOT NULL REFERENCES productos(id),
  cantidad      NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,4) NOT NULL CHECK (precio_unitario >= 0),
  descuento     NUMERIC(14,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(14,2) NOT NULL
);

-- =====================================================================
-- 8. KARDEX
-- =====================================================================
CREATE TABLE kardex (
  id            BIGSERIAL PRIMARY KEY,
  almacen_id    INT NOT NULL REFERENCES almacenes(id),
  producto_id   INT NOT NULL REFERENCES productos(id),
  tipo          tipo_movimiento NOT NULL,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
  cantidad      NUMERIC(14,3) NOT NULL,          -- (+) entrada, (-) salida
  costo_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  saldo_cantidad NUMERIC(14,3) NOT NULL,
  saldo_valorizado NUMERIC(16,4) NOT NULL,
  compra_id     INT REFERENCES compras(id),
  venta_id      INT REFERENCES ventas(id),
  motivo        VARCHAR(200),
  usuario_id    INT NOT NULL REFERENCES usuarios(id),
  CHECK (compra_id IS NOT NULL OR venta_id IS NOT NULL OR tipo IN ('AJUSTE','TRANSFERENCIA'))
);
CREATE INDEX idx_kardex_prod_alm_fecha ON kardex (producto_id, almacen_id, fecha DESC);

-- =====================================================================
-- 9. TESORERÍA
-- =====================================================================
CREATE TABLE cuentas_por_cobrar (
  id            SERIAL PRIMARY KEY,
  venta_id      INT NOT NULL REFERENCES ventas(id),
  cliente_id    INT NOT NULL REFERENCES clientes(id),
  monto_original NUMERIC(14,2) NOT NULL,
  saldo         NUMERIC(14,2) NOT NULL,
  vencimiento   DATE NOT NULL,
  estado        VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE'
);

CREATE TABLE cuentas_por_pagar (
  id            SERIAL PRIMARY KEY,
  compra_id     INT NOT NULL REFERENCES compras(id),
  proveedor_id  INT NOT NULL REFERENCES proveedores(id),
  monto_original NUMERIC(14,2) NOT NULL,
  saldo         NUMERIC(14,2) NOT NULL,
  vencimiento   DATE NOT NULL,
  estado        VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE'
);

CREATE TABLE movimientos_caja (
  id            BIGSERIAL PRIMARY KEY,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
  monto         NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  moneda_id     INT NOT NULL REFERENCES monedas(id),
  forma_pago_id INT REFERENCES formas_pago(id),
  cxc_id        INT REFERENCES cuentas_por_cobrar(id),
  cxp_id        INT REFERENCES cuentas_por_pagar(id),
  concepto      VARCHAR(200),
  usuario_id    INT NOT NULL REFERENCES usuarios(id)
);

-- =====================================================================
-- 10. DOCUMENTOS ADJUNTOS (metadatos en PG, binario en S3)
-- =====================================================================
CREATE TABLE documentos_adjuntos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad       VARCHAR(30) NOT NULL,            -- 'compra' | 'venta'
  entidad_id    INT NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  tamano_bytes  BIGINT NOT NULL,
  s3_bucket     VARCHAR(100) NOT NULL,
  s3_key        VARCHAR(500) NOT NULL,
  checksum_sha256 CHAR(64),
  usuario_id    INT NOT NULL REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_entidad ON documentos_adjuntos (entidad, entidad_id);

-- =====================================================================
-- 11. AUDITORÍA TRANSACCIONAL
-- =====================================================================
CREATE TABLE auditoria (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    INT REFERENCES usuarios(id),
  accion        VARCHAR(30) NOT NULL,            -- INSERT, UPDATE, ANULAR, LOGIN...
  modulo        VARCHAR(50) NOT NULL,
  registro_afectado VARCHAR(100) NOT NULL,       -- ej. 'compras:125'
  fecha_hora    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado     resultado_audit NOT NULL,
  ip_origen     INET,
  detalle       JSONB
);
CREATE INDEX idx_audit_modulo_fecha ON auditoria (modulo, fecha_hora DESC);
CREATE INDEX idx_audit_usuario ON auditoria (usuario_id, fecha_hora DESC);
