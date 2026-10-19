import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { post } from '../../services/api'
import { Button, Field, Modal, inputCls, useToast } from '../../components/ui'
import { errMsg, money, num } from '../../utils/format'
import { Row } from '../../types'

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

/** Modal "Confirmar Registro de Kardex": valida el comprobante y confirma el ingreso físico al almacén. */
export default function KardexEntryModal({ compra, onClose, onDone }: { compra: Row; onClose: () => void; onDone?: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [f, setF] = useState({ tipo_comprobante: 'FACTURA', serie: '', numero: '', fecha_ingreso: nowLocal(), observaciones: '' })
  const valid = f.serie.trim() && f.numero.trim()

  const m = useMutation({
    mutationFn: () => post('/inventory/kardex-entry', {
      compra_id: compra.id, tipo_comprobante: f.tipo_comprobante, serie: f.serie, numero: f.numero,
      fecha_ingreso: f.fecha_ingreso ? new Date(f.fecha_ingreso).toISOString() : null, observaciones: f.observaciones || null,
    }),
    onSuccess: () => {
      for (const k of ['purchases', 'stock', 'kardex', 'dashboard', 'cxp']) qc.invalidateQueries({ queryKey: [k] })
      toast(`Orden ${compra.numero_oc} ingresada al kardex`); onDone?.(); onClose()
    },
    onError: (e) => toast(errMsg(e), 'error'),
  })

  return (
    <Modal open onClose={onClose} title="Confirmar Registro de Kardex" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>Confirmar Registro de Kardex</Button></>}>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
        <div><div className="text-xs text-slate-500">Orden</div><div className="font-semibold">{compra.numero_oc}</div></div>
        <div className="col-span-1 sm:col-span-2"><div className="text-xs text-slate-500">Proveedor</div><div className="font-semibold">{compra.proveedor}</div><div className="text-xs text-slate-500">RUC {compra.ruc}</div></div>
        <div><div className="text-xs text-slate-500">Almacén receptor</div><div className="font-semibold">{compra.almacen}</div></div>
      </div>

      <h4 className="mb-1 text-sm font-semibold text-slate-700">Mercadería a recepcionar</h4>
      <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 text-right">Cantidad</th><th className="px-3 text-right">P. unit.</th><th className="px-3 text-right">Subtotal</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(compra.lineas ?? []).map((l: Row) => (
              <tr key={l.id}><td className="px-3 py-1.5">{l.sku} · {l.producto}</td><td className="px-3 text-right tabular-nums">{num(l.cantidad, 3)}</td>
                <td className="px-3 text-right tabular-nums">{money(l.precio_unitario)}</td><td className="px-3 text-right tabular-nums">{money(l.subtotal)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-slate-200 font-semibold"><td colSpan={3} className="px-3 py-2 text-right">Total {compra.moneda}</td><td className="px-3 text-right tabular-nums">{money(compra.total)}</td></tr></tfoot>
        </table>
      </div>

      <h4 className="mb-1 text-sm font-semibold text-slate-700">Datos del comprobante del proveedor</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Tipo *"><select className={inputCls} value={f.tipo_comprobante} onChange={(e) => setF({ ...f, tipo_comprobante: e.target.value })}>
          <option value="FACTURA">Factura</option><option value="GUIA_REMISION">Guía de remisión</option><option value="BOLETA">Boleta</option></select></Field>
        <Field label="Serie *"><input className={inputCls} value={f.serie} maxLength={10} placeholder="F001" onChange={(e) => setF({ ...f, serie: e.target.value.toUpperCase() })} /></Field>
        <Field label="Número *"><input className={inputCls} value={f.numero} maxLength={20} placeholder="000123" onChange={(e) => setF({ ...f, numero: e.target.value })} /></Field>
        <Field label="Fecha de ingreso"><input type="datetime-local" className={inputCls} value={f.fecha_ingreso} onChange={(e) => setF({ ...f, fecha_ingreso: e.target.value })} /></Field>
        <Field label="Observaciones" className="sm:col-span-4"><input className={inputCls} value={f.observaciones} onChange={(e) => setF({ ...f, observaciones: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>Esta operación es atómica e irreversible: cierra la orden como <b>Ingresado/Cerrado</b>, registra los movimientos en el kardex, actualiza el stock del almacén receptor y genera la cuenta por pagar.</span>
      </div>
    </Modal>
  )
}
