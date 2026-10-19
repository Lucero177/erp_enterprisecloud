export type Row = Record<string, any>

export interface User {
  id: number
  username: string
  nombre_completo: string
  email: string
  empresa_id: number
  rol: string
  permisos: string[]
}

export interface Linea {
  producto_id: number | ''
  cantidad: number
  precio_unitario: number
  descuento: number
}
