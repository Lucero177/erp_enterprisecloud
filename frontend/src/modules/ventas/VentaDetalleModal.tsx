import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCheck2 } from 'lucide-react'
import { get, post } from '../../services/api'
import { Badge, Button, Field, Modal, inputCls, useToast } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { errMsg, fdate, fdatetime, money, num } from '../../utils/format'
import { Row } from '../../types'
import Adjuntos from '../documentos/Adjuntos'

export default function VentaDetalleModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [fac, setFac] = useState({ tipo_comprobante: 'FACTURA', serie: '' })
  const { data: v } = useQuery({ queryKey: ['sales', 'ov', id], queryFn: () => get(`/sales/ordenes/${id}`) })
  const refresh = () => { for (const k of ['sales', 'stock', 'kardex', 'dashboard', 'cxc']) qc.invalidateQueries({ queryKey: [k] }) }
  const facturar = useMutation({ mutationFn: () => post(`/sales/ordenes/${id}/facturar`, { tipo_comprobante: fac.tipo_comprobante, serie: fac.serie || null }),
    onSuccess: (r) => { refresh(); toast(`Comprobante ${r.serie_comprobante}-${r.numero_comprobante} emitido`) }, onError: (e) => toast(errMsg(e), 'error') })
  const anular = useMutation({ mutationFn: () => post(`/sales/ordenes/${id}/anular`, {}),
    onSuccess: () => { refresh(); toast('Documento anulado') }, onError: (e) => toast(errMsg(e), 'error') })
  if (!v) return null
  return (
    <Modal open onClose={onClose} size="lg" title={v.numero_comprobante ? `${v.tipo_comprobante} ${v.serie_comprobante}-${v.numero_comprobante}` : `Orden de venta ${v.numero_ov}`}
      footer={<>
        {['EMITIDO', 'FACTURADO'].includes(v.estado) && can('ventas', 'update') && <Button variant="danger" loading={anular.isPending} onClick={() => confirm(v.estado === 'FACTURADO' ? '¿Anular el comprobante? Se repondrá el stock.' : '¿Anular la orden?') && anular.mutate()}>Anular</Button>}
        <Button variant="secondary" onClick={onClose}>Cerrar</Button></>}>
      <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="col-span-2"><div className="text-xs text-slate-500">Cliente</div><b>{v.cliente}</b><div className="text-xs text-slate-500">{v.documento}</div></div>
        <div><div className="text-xs text-slate-500">Orden / Fecha</div>{v.numero_ov} · {fdate(v.fecha)}</div>
        <div><div className="text-xs text-slate-500">Estado</div><Badge value={v.estado} /></div>
        <div><div className="text-xs text-slate-500">Almacén</div>{v.almacen}</div>
        {v.fecha_emision && <div><div className="text-xs text-slate-500">Emitido</div>{fdatetime(v.fecha_emision)}</div>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 text-right">Cant.</th><th className="px-3 text-right">P. unit.</th><th className="px-3 text-right">Desc.</th><th className="px-3 text-right">Subtotal</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{v.lineas.map((l: Row) => <tr key={l.id}><td className="px-3 py-1.5">{l.sku} · {l.producto}</td><td className="px-3 text-right tabular-nums">{num(l.cantidad, 3)}</td><td className="px-3 text-right tabular-nums">{money(l.precio_unitario)}</td><td className="px-3 text-right tabular-nums">{money(l.descuento)}</td><td className="px-3 text-right tabular-nums">{money(l.subtotal)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={4} className="px-3 py-1 text-right text-slate-500">Subtotal</td><td className="px-3 text-right tabular-nums">{money(v.subtotal, v.moneda)}</td></tr>
            <tr><td colSpan={4} className="px-3 py-1 text-right text-slate-500">IGV</td><td className="px-3 text-right tabular-nums">{money(v.impuesto, v.moneda)}</td></tr>
            <tr className="font-semibold"><td colSpan={4} className="px-3 py-1.5 text-right">Total</td><td className="px-3 text-right tabular-nums">{money(v.total, v.moneda)}</td></tr></tfoot></table>
      </div>
      {v.estado === 'EMITIDO' && can('ventas', 'approve') && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <Field label="Comprobante"><select className={inputCls} value={fac.tipo_comprobante} onChange={(e) => setFac({ ...fac, tipo_comprobante: e.target.value })}><option value="FACTURA">Factura</option><option value="BOLETA">Boleta</option></select></Field>
          <Field label="Serie" hint="Vacío = F001 / B001"><input className={inputCls + ' w-28'} value={fac.serie} maxLength={10} onChange={(e) => setFac({ ...fac, serie: e.target.value.toUpperCase() })} /></Field>
          <Button loading={facturar.isPending} onClick={() => facturar.mutate()}><FileCheck2 size={15} /> Facturar y descontar stock</Button>
        </div>
      )}
      <Adjuntos entidad="venta" entidadId={v.id} />
    </Modal>
  )
}
