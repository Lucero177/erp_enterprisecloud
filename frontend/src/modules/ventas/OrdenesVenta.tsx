import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Plus } from 'lucide-react'
import { get } from '../../services/api'
import { Badge, Button, Col, DataTable, Field, Filters, PageHeader, inputCls } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { fdate, money } from '../../utils/format'
import { Row } from '../../types'
import VentaForm from './VentaForm'
import VentaDetalleModal from './VentaDetalleModal'

export const ventaCols = (open: (id: number) => void): Col<Row>[] => [
  { header: 'Orden', cell: (r) => <b>{r.numero_ov}</b> }, { header: 'Fecha', cell: (r) => fdate(r.fecha) }, { header: 'Cliente', cell: (r) => r.cliente },
  { header: 'Comprobante', cell: (r) => (r.numero_comprobante ? `${r.serie_comprobante}-${r.numero_comprobante}` : '—') },
  { header: 'Total', align: 'right', cell: (r) => <b>{money(r.total, r.moneda)}</b> }, { header: 'Estado', cell: (r) => <Badge value={r.estado} /> },
  { header: '', cell: (r) => <Button variant="ghost" onClick={() => open(r.id)}><Eye size={15} /></Button> },
]

export default function OrdenesVenta() {
  const { can } = useAuth()
  const [f, setF] = useState({ q: '', estado: '' })
  const [form, setForm] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['sales', 'ov-list', f], queryFn: () => get<{ items: Row[] }>('/sales/ordenes', f) })
  return (
    <>
      <PageHeader title="Orden de Venta" subtitle="Pedidos de clientes; se facturan desde aquí o desde Facturación"
        actions={can('ventas', 'create') && <Button onClick={() => setForm(true)}><Plus size={16} /> Nueva orden</Button>} />
      <Filters>
        <Field label="Buscar"><input className={inputCls + ' w-64'} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
        <Field label="Estado"><select className={inputCls} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Todos</option>{['BORRADOR', 'EMITIDO', 'FACTURADO', 'ANULADO'].map((s) => <option key={s}>{s}</option>)}</select></Field>
      </Filters>
      <DataTable columns={ventaCols(setSel)} rows={data?.items} loading={isLoading} onRowClick={(r) => setSel(r.id)} />
      {form && <VentaForm kind="orden" onClose={() => setForm(false)} />}
      {sel && <VentaDetalleModal id={sel} onClose={() => setSel(null)} />}
    </>
  )
}
