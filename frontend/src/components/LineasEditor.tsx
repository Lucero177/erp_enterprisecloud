import { Plus, Trash2 } from 'lucide-react'
import { Button, inputCls } from './ui'
import { useMaster, labelOf } from '../hooks/useLookups'
import { Linea, Row } from '../types'
import { money } from '../utils/format'

export const emptyLinea = (): Linea => ({ producto_id: '', cantidad: 1, precio_unitario: 0, descuento: 0 })

/** Cálculo de totales idéntico al del backend (impuesto por producto; IGV 18% por defecto). */
export function calcTotals(lineas: Linea[], productos: Row[] = [], impuestos: Row[] = []) {
  let sub = 0, imp = 0
  for (const l of lineas) {
    if (l.producto_id === '') continue
    const p = productos.find((x) => x.id === Number(l.producto_id))
    const pct = Number(impuestos.find((i) => i.id === p?.impuesto_id)?.porcentaje ?? 18)
    const s = Math.round((l.cantidad * l.precio_unitario - (l.descuento || 0)) * 100) / 100
    sub += s
    imp += Math.round(s * pct) / 100
  }
  sub = Math.round(sub * 100) / 100
  imp = Math.round(imp * 100) / 100
  return { subtotal: sub, impuesto: imp, total: Math.round((sub + imp) * 100) / 100 }
}

export default function LineasEditor({ lineas, onChange, showDiscount = false, currency = '', priceFrom }:
  { lineas: Linea[]; onChange: (l: Linea[]) => void; showDiscount?: boolean; currency?: string; priceFrom?: 'costo' | 'none' }) {
  const { data: productos = [] } = useMaster('productos')
  const { data: impuestos = [] } = useMaster('impuestos')
  const set = (i: number, patch: Partial<Linea>) => onChange(lineas.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const t = calcTotals(lineas, productos, impuestos)

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-2 py-2 text-left">Producto</th><th className="w-24 px-2 text-right">Cantidad</th><th className="w-32 px-2 text-right">Precio unit.</th>
              {showDiscount && <th className="w-28 px-2 text-right">Descuento</th>}<th className="w-32 px-2 text-right">Subtotal</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lineas.map((l, i) => (
              <tr key={i}>
                <td className="p-1.5">
                  <select className={inputCls} value={l.producto_id} onChange={(e) => {
                    const id = e.target.value === '' ? '' : Number(e.target.value)
                    const p = productos.find((x) => x.id === id)
                    set(i, { producto_id: id, ...(priceFrom === 'costo' && p && !l.precio_unitario ? { precio_unitario: Number(p.costo_promedio) } : {}) })
                  }}>
                    <option value="">— Seleccione producto —</option>
                    {productos.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{labelOf('productos', p)}</option>)}
                  </select>
                </td>
                <td className="p-1.5"><input type="number" min="0" step="0.001" className={inputCls + ' text-right'} value={l.cantidad} onChange={(e) => set(i, { cantidad: Number(e.target.value) })} /></td>
                <td className="p-1.5"><input type="number" min="0" step="0.0001" className={inputCls + ' text-right'} value={l.precio_unitario} onChange={(e) => set(i, { precio_unitario: Number(e.target.value) })} /></td>
                {showDiscount && <td className="p-1.5"><input type="number" min="0" step="0.01" className={inputCls + ' text-right'} value={l.descuento} onChange={(e) => set(i, { descuento: Number(e.target.value) })} /></td>}
                <td className="px-2 text-right tabular-nums">{money(l.cantidad * l.precio_unitario - (l.descuento || 0))}</td>
                <td className="p-1.5"><button type="button" onClick={() => onChange(lineas.filter((_, j) => j !== i))} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => onChange([...lineas, emptyLinea()])}><Plus size={14} /> Agregar línea</Button>
        <div className="w-60 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{money(t.subtotal, currency)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Impuestos (IGV)</span><span className="tabular-nums">{money(t.impuesto, currency)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(t.total, currency)}</span></div>
        </div>
      </div>
    </div>
  )
}
