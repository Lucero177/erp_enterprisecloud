import { useQuery } from '@tanstack/react-query'
import { get } from '../services/api'
import { Row } from '../types'

/** Lista de un maestro (cacheada) — usada para selects y para mostrar nombres de FK. */
export function useMaster(slug: string, enabled = true) {
  return useQuery({ queryKey: ['master', slug], queryFn: () => get<{ items: Row[] }>(`/${slug}`, { limit: 2000 }).then((r) => r.items), staleTime: 60_000, enabled })
}

export const LABELS: Record<string, (r: Row) => string> = {
  empresas: (r) => r.razon_social,
  sucursales: (r) => r.nombre,
  almacenes: (r) => `${r.codigo} · ${r.nombre}`,
  zonas: (r) => r.nombre,
  vendedores: (r) => r.nombre,
  clientes: (r) => `${r.documento} · ${r.razon_social}`,
  proveedores: (r) => `${r.ruc} · ${r.razon_social}`,
  transportistas: (r) => `${r.ruc} · ${r.razon_social}`,
  productos: (r) => `${r.sku} · ${r.nombre}`,
  categorias: (r) => r.nombre,
  marcas: (r) => r.nombre,
  'unidades-medida': (r) => `${r.codigo} · ${r.nombre}`,
  monedas: (r) => `${r.codigo} · ${r.nombre}`,
  impuestos: (r) => `${r.codigo} (${r.porcentaje}%)`,
  'formas-pago': (r) => r.nombre,
  'listas-precios': (r) => r.nombre,
}

export const labelOf = (slug: string, r: Row) => (LABELS[slug] ? LABELS[slug](r) : String(r.nombre ?? r.id))
