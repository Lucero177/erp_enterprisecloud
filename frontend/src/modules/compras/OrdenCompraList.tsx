import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, PackageCheck, Plus } from 'lucide-react'
import { get, post } from '../../services/api'
import { Badge, Button, Col, DataTable, Field, Filters, Modal, PageHeader, inputCls, useToast } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { useAuth } from '../../store/auth'
import { errMsg, fdate, fdatetime, money, num } from '../../utils/format'
import { Row } from '../../types'
import Adjuntos from '../documentos/Adjuntos'
import KardexEntryModal from './KardexEntryModal'

export function OrdenDetalleModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [entry, setEntry] = useState(false)
  const { data: c } = useQuery({ queryKey: ['purchases', 'detail', id], queryFn: () => get(`/purchases/${id}`) })
  const act = useMutation({
    mutationFn: (a: 'emitir' | 'anular') => post(`/purchases/${id}/${a}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); toast('Estado actualizado') },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  if (!c) return null
  return (
    <>
      <Modal open onClose={onClose} title={`Orden de compra ${c.numero_oc}`} size="lg"
        footer={<>
          {c.estado === 'BORRADOR' && can('compras', 'update') && <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate('emitir')}>Emitir</Button>}
          {['BORRADOR', 'EMITIDO'].includes(c.estado) && can('compras', 'update') && <Button variant="danger" loading={act.isPending} onClick={() => confirm('¿Anular la orden?') && act.mutate('anular')}>Anular</Button>}
          {c.estado === 'EMITIDO' && can('compras', 'approve') && <Button onClick={() => setEntry(true)}><PackageCheck size={15} /> Ingresar al Kardex</Button>}
          <Button variant="secondary" onClick={onClose}>Cerrar</Button></>}>
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><div className="text-xs text-slate-500">Proveedor</div><b>{c.proveedor}</b><div className="text-xs text-slate-500">RUC {c.ruc}</div></div>
          <div><div className="text-xs text-slate-500">Fecha</div>{fdate(c.fecha)}</div>
          <div><div className="text-xs text-slate-500">Almacén</div>{c.almacen}</div>
          <div><div className="text-xs text-slate-500">Estado</div><Badge value={c.estado} /></div>
          {c.numero_comprobante && <div className="col-span-2"><div className="text-xs text-slate-500">Comprobante de ingreso</div>{c.tipo_comprobante} {c.serie_comprobante}-{c.numero_comprobante} · {fdatetime(c.fecha_ingreso)}</div>}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Producto</th><th className="px-3 text-right">Cant.</th><th className="px-3 text-right">P. unit.</th><th className="px-3 text-right">Subtotal</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{c.lineas.map((l: Row) => <tr key={l.id}><td className="px-3 py-1.5">{l.sku} · {l.producto}</td><td className="px-3 text-right tabular-nums">{num(l.cantidad, 3)}</td><td className="px-3 text-right tabular-nums">{money(l.precio_unitario)}</td><td className="px-3 text-right tabular-nums">{money(l.subtotal)}</td></tr>)}</tbody>
            <tfoot className="text-sm"><tr><td colSpan={3} className="px-3 py-1 text-right text-slate-500">Subtotal</td><td className="px-3 text-right tabular-nums">{money(c.subtotal, c.moneda)}</td></tr>
              <tr><td colSpan={3} className="px-3 py-1 text-right text-slate-500">IGV</td><td className="px-3 text-right tabular-nums">{money(c.impuesto, c.moneda)}</td></tr>
              <tr className="font-semibold"><td colSpan={3} className="px-3 py-1.5 text-right">Total</td><td className="px-3 text-right tabular-nums">{money(c.total, c.moneda)}</td></tr></tfoot></table>
        </div>
        <Adjuntos entidad="compra" entidadId={c.id} />
      </Modal>
      {entry && <KardexEntryModal compra={c} onClose={() => setEntry(false)} onDone={onClose} />}
    </>
  )
}

export default function OrdenCompraList() {
  const nav = useNavigate()
  const { can } = useAuth()
  const { data: provs = [] } = useMaster('proveedores')
  const [f, setF] = useState({ q: '', proveedor_id: '', estado: '', desde: '', hasta: '' })
  const [sel, setSel] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['purchases', f], queryFn: () => get<{ items: Row[] }>('/purchases', f) })
  const cols: Col<Row>[] = [
    { header: 'N° OC', cell: (r) => <b>{r.numero_oc}</b> }, { header: 'Fecha', cell: (r) => fdate(r.fecha) },
    { header: 'Proveedor', cell: (r) => r.proveedor }, { header: 'RUC', cell: (r) => r.ruc }, { header: 'Almacén', cell: (r) => r.almacen },
    { header: 'Subtotal', align: 'right', cell: (r) => money(r.subtotal) }, { header: 'IGV', align: 'right', cell: (r) => money(r.impuesto) },
    { header: 'Total', align: 'right', cell: (r) => <b>{money(r.total, r.moneda)}</b> }, { header: 'Estado', cell: (r) => <Badge value={r.estado} /> },
    { header: '', cell: (r) => <Button variant="ghost" onClick={() => setSel(r.id)}><Eye size={15} /></Button> },
  ]
  return (
    <>
      <PageHeader title="Orden de Compra" subtitle="Listado, filtros y emisión de órdenes"
        actions={can('compras', 'create') && <Button onClick={() => nav('/compras/ordenes/nueva')}><Plus size={16} /> Nueva orden</Button>} />
      <Filters>
        <Field label="Buscar (N° OC, RUC, razón social)"><input className={inputCls + ' w-64'} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
        <Field label="Proveedor"><select className={inputCls + ' w-56'} value={f.proveedor_id} onChange={(e) => setF({ ...f, proveedor_id: e.target.value })}><option value="">Todos</option>{provs.map((p) => <option key={p.id} value={p.id}>{labelOf('proveedores', p)}</option>)}</select></Field>
        <Field label="Estado"><select className={inputCls} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Todos</option>{['BORRADOR', 'EMITIDO', 'INGRESADO_CERRADO', 'ANULADO'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Desde"><input type="date" className={inputCls} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></Field>
      </Filters>
      <DataTable columns={cols} rows={data?.items} loading={isLoading} onRowClick={(r) => setSel(r.id)} />
      {sel && <OrdenDetalleModal id={sel} onClose={() => setSel(null)} />}
    </>
  )
}
