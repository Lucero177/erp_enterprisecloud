import { createContext, ReactNode, useCallback, useContext, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import { Row } from '../types'

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:text-slate-500'

/* ---------- Toasts ---------- */
type ToastType = 'ok' | 'error'
const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; type: ToastType }[]>([])
  const push = useCallback((msg: string, type: ToastType = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, msg, type }])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), type === 'error' ? 7000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg',
            t.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>
            {t.type === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------- Botones ---------- */
export function Button({ variant = 'primary', loading, className, children, ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }) {
  const v = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant]
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50', v, className)}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Layout de página ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
)

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn('my-8 w-full rounded-xl bg-white shadow-2xl', w)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Estados ---------- */
const COLORS: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-600', EMITIDO: 'bg-blue-100 text-blue-700', APROBADO: 'bg-indigo-100 text-indigo-700',
  FACTURADO: 'bg-emerald-100 text-emerald-700', INGRESADO_CERRADO: 'bg-emerald-100 text-emerald-700', ANULADO: 'bg-red-100 text-red-700',
  PENDIENTE: 'bg-amber-100 text-amber-700', PARCIAL: 'bg-orange-100 text-orange-700', PAGADO: 'bg-emerald-100 text-emerald-700',
  OK: 'bg-emerald-100 text-emerald-700', BAJO: 'bg-amber-100 text-amber-700', SIN_STOCK: 'bg-red-100 text-red-700',
  EXITO: 'bg-emerald-100 text-emerald-700', FALLO: 'bg-red-100 text-red-700', DENEGADO: 'bg-orange-100 text-orange-700',
  ENTRADA: 'bg-emerald-100 text-emerald-700', SALIDA: 'bg-rose-100 text-rose-700', AJUSTE: 'bg-violet-100 text-violet-700',
  INGRESO: 'bg-emerald-100 text-emerald-700', EGRESO: 'bg-rose-100 text-rose-700',
}
export const Badge = ({ value }: { value?: string | null }) =>
  value ? <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', COLORS[value] ?? 'bg-slate-100 text-slate-600')}>{value.replace('_', ' ')}</span> : null

/* ---------- Tabla ---------- */
export interface Col<T> { header: string; cell: (r: T) => ReactNode; align?: 'right' | 'center'; className?: string }

export function DataTable<T extends Row>({ columns, rows, loading, empty = 'Sin registros', onRowClick }:
  { columns: Col<T>[]; rows?: T[]; loading?: boolean; empty?: string; onRowClick?: (r: T) => void }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c, i) => (
            <th key={i} className={cn('px-3 py-2.5 font-medium', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')}>{c.header}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>}
          {!loading && !rows?.length && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">{empty}</td></tr>}
          {rows?.map((r, i) => (
            <tr key={(r.id as string | number) ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('hover:bg-slate-50', onRowClick && 'cursor-pointer')}>
              {columns.map((c, j) => (
                <td key={j} className={cn('px-3 py-2', c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : '', c.className)}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export const Tabs = ({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) => (
  <div className="mb-4 flex gap-1 border-b border-slate-200">
    {tabs.map((t) => (
      <button key={t.id} onClick={() => onChange(t.id)}
        className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', value === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
        {t.label}
      </button>
    ))}
  </div>
)

export const Spinner = () => <Loader2 className="mx-auto my-10 animate-spin text-slate-400" />

export function Filters({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3">{children}</div>
}
