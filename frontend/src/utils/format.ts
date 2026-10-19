import axios from 'axios'

export const num = (v: unknown, d = 2) =>
  Number(v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d })

export const money = (v: unknown, cur = '') => `${cur ? cur + ' ' : ''}${num(v, 2)}`

export const fdate = (v?: string | null) => (v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('es-PE') : '—')

export const fdatetime = (v?: string | null) => (v ? new Date(v).toLocaleString('es-PE') : '—')

export const today = () => new Date().toISOString().slice(0, 10)

export function errMsg(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((x) => `${(x.loc ?? []).slice(1).join('.')}: ${x.msg}`).join(' · ')
    return e.message
  }
  return e instanceof Error ? e.message : 'Error inesperado'
}
