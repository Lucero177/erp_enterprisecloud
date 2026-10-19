export type FieldType = 'text' | 'number' | 'date' | 'select' | 'bool' | 'email'
export interface FieldDef {
  key: string; label: string; type?: FieldType; required?: boolean
  optionsFrom?: string; step?: string; hint?: string; hideInTable?: boolean; default?: unknown
}
export interface MasterDef {
  slug: string; title: string; subtitle: string; fields: FieldDef[]
  injectEmpresa?: boolean; tabGroup?: string[]; prices?: boolean
}

const A: FieldDef = { key: 'activo', label: 'Activo', type: 'bool', default: true }

export const MASTERS: MasterDef[] = [
  { slug: 'empresas', title: 'Empresas', subtitle: 'Razones sociales del grupo', fields: [
    { key: 'ruc', label: 'RUC', required: true }, { key: 'razon_social', label: 'Razón social', required: true },
    { key: 'direccion', label: 'Dirección', hideInTable: true }, A] },
  { slug: 'sucursales', title: 'Sucursales', subtitle: 'Sedes de la empresa', injectEmpresa: true, fields: [
    { key: 'nombre', label: 'Nombre', required: true }, { key: 'direccion', label: 'Dirección' }, A] },
  { slug: 'almacenes', title: 'Almacenes', subtitle: 'Almacenes por sucursal', fields: [
    { key: 'codigo', label: 'Código', required: true }, { key: 'nombre', label: 'Nombre', required: true },
    { key: 'sucursal_id', label: 'Sucursal', type: 'select', optionsFrom: 'sucursales', required: true }, A] },
  { slug: 'clientes', title: 'Clientes', subtitle: 'Cartera de clientes y crédito', injectEmpresa: true, fields: [
    { key: 'documento', label: 'RUC / DNI', required: true }, { key: 'razon_social', label: 'Razón social', required: true },
    { key: 'email', label: 'Email', type: 'email', hideInTable: true }, { key: 'telefono', label: 'Teléfono', hideInTable: true },
    { key: 'direccion', label: 'Dirección', hideInTable: true },
    { key: 'zona_id', label: 'Zona', type: 'select', optionsFrom: 'zonas' }, { key: 'vendedor_id', label: 'Vendedor', type: 'select', optionsFrom: 'vendedores', hideInTable: true },
    { key: 'forma_pago_id', label: 'Forma de pago', type: 'select', optionsFrom: 'formas-pago' },
    { key: 'lista_precios_id', label: 'Lista de precios', type: 'select', optionsFrom: 'listas-precios', hideInTable: true },
    { key: 'limite_credito', label: 'Límite de crédito', type: 'number', hint: '0 = sin límite', default: 0 }, A] },
  { slug: 'proveedores', title: 'Proveedores', subtitle: 'Proveedores y condiciones de pago', injectEmpresa: true, fields: [
    { key: 'ruc', label: 'RUC', required: true }, { key: 'razon_social', label: 'Razón social', required: true },
    { key: 'email', label: 'Email', type: 'email', hideInTable: true }, { key: 'telefono', label: 'Teléfono' },
    { key: 'direccion', label: 'Dirección', hideInTable: true },
    { key: 'forma_pago_id', label: 'Forma de pago', type: 'select', optionsFrom: 'formas-pago' }, A] },
  { slug: 'transportistas', title: 'Transportistas', subtitle: 'Empresas de transporte', fields: [
    { key: 'ruc', label: 'RUC', required: true }, { key: 'razon_social', label: 'Razón social', required: true }, { key: 'telefono', label: 'Teléfono' }, A] },
  { slug: 'vendedores', title: 'Vendedores', subtitle: 'Fuerza de ventas', fields: [
    { key: 'nombre', label: 'Nombre', required: true }, { key: 'email', label: 'Email', type: 'email' },
    { key: 'zona_id', label: 'Zona', type: 'select', optionsFrom: 'zonas' }, A] },
  { slug: 'zonas', title: 'Zonas', subtitle: 'Zonas comerciales', fields: [{ key: 'nombre', label: 'Nombre', required: true }] },
  { slug: 'productos', title: 'Productos', subtitle: 'Catálogo de productos', injectEmpresa: true, fields: [
    { key: 'sku', label: 'SKU', required: true }, { key: 'nombre', label: 'Nombre', required: true },
    { key: 'categoria_id', label: 'Categoría', type: 'select', optionsFrom: 'categorias' }, { key: 'marca_id', label: 'Marca', type: 'select', optionsFrom: 'marcas' },
    { key: 'unidad_id', label: 'Unidad', type: 'select', optionsFrom: 'unidades-medida', required: true },
    { key: 'impuesto_id', label: 'Impuesto', type: 'select', optionsFrom: 'impuestos', hideInTable: true },
    { key: 'stock_minimo', label: 'Stock mínimo', type: 'number', step: '0.001', default: 0 },
    { key: 'costo_promedio', label: 'Costo promedio', type: 'number', step: '0.0001', hint: 'Se recalcula con cada ingreso', hideInTable: true, default: 0 }, A] },
  { slug: 'categorias', title: 'Categorías', subtitle: 'Clasificación de productos', fields: [
    { key: 'nombre', label: 'Nombre', required: true }, { key: 'padre_id', label: 'Categoría padre', type: 'select', optionsFrom: 'categorias' }] },
  { slug: 'marcas', title: 'Marcas', subtitle: 'Marcas de producto', fields: [{ key: 'nombre', label: 'Nombre', required: true }] },
  { slug: 'unidades-medida', title: 'Unidades de medida', subtitle: 'UND, CJA, KG…', fields: [
    { key: 'codigo', label: 'Código', required: true }, { key: 'nombre', label: 'Nombre', required: true }] },
  { slug: 'conversion-unidades', title: 'Conversión de unidades', subtitle: 'Factor de conversión entre unidades', fields: [
    { key: 'unidad_origen_id', label: 'Unidad origen', type: 'select', optionsFrom: 'unidades-medida', required: true },
    { key: 'unidad_destino_id', label: 'Unidad destino', type: 'select', optionsFrom: 'unidades-medida', required: true },
    { key: 'factor', label: 'Factor', type: 'number', step: '0.000001', required: true, hint: '1 origen = factor × destino' }] },
  { slug: 'monedas', title: 'Monedas', subtitle: 'Monedas y tipos de cambio', tabGroup: ['monedas', 'tipos-cambio'], fields: [
    { key: 'codigo', label: 'Código ISO', required: true }, { key: 'nombre', label: 'Nombre', required: true }, { key: 'simbolo', label: 'Símbolo' }] },
  { slug: 'tipos-cambio', title: 'Tipos de cambio', subtitle: 'Monedas y tipos de cambio', tabGroup: ['monedas', 'tipos-cambio'], fields: [
    { key: 'moneda_id', label: 'Moneda', type: 'select', optionsFrom: 'monedas', required: true }, { key: 'fecha', label: 'Fecha', type: 'date', required: true },
    { key: 'compra', label: 'Compra', type: 'number', step: '0.0001', required: true }, { key: 'venta', label: 'Venta', type: 'number', step: '0.0001', required: true }] },
  { slug: 'impuestos', title: 'Impuestos (IGV)', subtitle: 'Tasas de impuesto aplicables', fields: [
    { key: 'codigo', label: 'Código', required: true }, { key: 'nombre', label: 'Nombre', required: true },
    { key: 'porcentaje', label: 'Porcentaje %', type: 'number', required: true, default: 18 }] },
  { slug: 'formas-pago', title: 'Formas de pago', subtitle: 'Contado y créditos', fields: [
    { key: 'nombre', label: 'Nombre', required: true }, { key: 'dias_credito', label: 'Días de crédito', type: 'number', step: '1', default: 0 }] },
  { slug: 'listas-precios', title: 'Listas de precios', subtitle: 'Precios por producto y vigencia', prices: true, fields: [
    { key: 'nombre', label: 'Nombre', required: true }, { key: 'moneda_id', label: 'Moneda', type: 'select', optionsFrom: 'monedas', required: true },
    { key: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true }, { key: 'vigente_hasta', label: 'Vigente hasta', type: 'date' }, A] },
]

export const MASTER_BY_SLUG = Object.fromEntries(MASTERS.map((m) => [m.slug, m]))
