import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Plus } from 'lucide-react'
import { get, post } from '../../services/api'
import { Badge, Button, Col, DataTable, Field, Filters, Modal, PageHeader, inputCls, useToast } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { useAuth } from '../../store/auth'
import { errMsg, fdate, money, num } from '../../utils/format'
import { Row } from '../../types'
import VentaForm from './VentaForm'

export default function Cotizaciones() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const { data: alms = [] } = useMaster('almacenes')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(false)
  const [conv, setConv] = useState<Row | null>(null)
  const [alm, setAlm] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['sales', 'cot', q], queryFn: () => get<{ items: Row[] }>('/sales/cotizaciones', { q }) })
  const convertir = useMutation({
    mutationFn: () => post(`/sales/cotizaciones/${conv!.id}/convertir`, { almacen_id: Number(alm) }),
    onSuccess: (v) => { qc.invalidateQueries({ queryKey: ['sales'] }); toast(`Orden ${v.numero_ov} generada`); setConv(null) },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  const cols: Col<Row>[] = [
    { header: 'N°', cell: (r) => <b>{r.numero}</b> }, { header: 'Fecha', cell: (r) => fdate(r.fecha) }, { header: 'Cliente', cell: (r) => r.cliente },
    { header: 'Vigencia', cell: (r) => fdate(r.vigencia_hasta) }, { header: 'Total', align: 'right', cell: (r) => <b>{money(r.total, r.moneda)}</b> },
    { header: 'Estado', cell: (r) => <Badge value={r.estado} /> },
    { header: '', cell: (r) => r.estado === 'EMITIDO' && can('ventas', 'create') && <Button variant="secondary" onClick={() => { setConv(r); setAlm('') }}>Convertir <ArrowRight size={14} /></Button> },
  ]
  return (
    <>
      <PageHeader title="Cotizaciones" subtitle="Paso 1 del flujo: Cotización → Orden de Venta → Facturación → Estado de Cuenta"
        actions={can('ventas', 'create') && <Button onClick={() => setForm(true)}><Plus size={16} /> Nueva cotización</Button>} />
      <Filters><input className={inputCls + ' max-w-xs'} placeholder="Buscar N° o cliente…" value={q} onChange={(e) => setQ(e.target.value)} /></Filters>
      <DataTable columns={cols} rows={data?.items} loading={isLoading} />
      {form && <VentaForm kind="cotizacion" onClose={() => setForm(false)} />}
      <Modal open={!!conv} onClose={() => setConv(null)} size="sm" title={`Convertir ${conv?.numero} en orden de venta`}
        footer={<><Button variant="secondary" onClick={() => setConv(null)}>Cancelar</Button><Button disabled={!alm} loading={convertir.isPending} onClick={() => convertir.mutate()}>Generar orden</Button></>}>
        <Field label="Almacén de despacho *"><select className={inputCls} value={alm} onChange={(e) => setAlm(e.target.value)}><option value="">— Seleccione —</option>{alms.map((a) => <option key={a.id} value={a.id}>{labelOf('almacenes', a)}</option>)}</select></Field>
      </Modal>
    </>
  )
}
