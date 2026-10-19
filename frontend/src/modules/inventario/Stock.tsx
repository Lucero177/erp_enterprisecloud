import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { get, post } from '../../services/api'
import { Badge, Button, Card, Col, DataTable, Field, Filters, Modal, PageHeader, inputCls, useToast } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { useAuth } from '../../store/auth'
import { errMsg, money, num } from '../../utils/format'
import { Row } from '../../types'

export default function Stock() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const { data: alms = [] } = useMaster('almacenes')
  const [f, setF] = useState({ almacen_id: '', q: '', solo_alertas: false })
  const [adj, setAdj] = useState<Row | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['stock', f], queryFn: () => get<Row[]>('/inventory/stock', f) })
  const total = (data ?? []).reduce((a, r) => a + Number(r.valorizado), 0)
  const ajustar = useMutation({
    mutationFn: () => post('/inventory/adjustment', { almacen_id: adj!.almacen_id, producto_id: adj!.producto_id, cantidad: Number(adj!.delta), motivo: adj!.motivo }),
    onSuccess: () => { for (const k of ['stock', 'kardex', 'dashboard']) qc.invalidateQueries({ queryKey: [k] }); toast('Ajuste registrado'); setAdj(null) },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  const cols: Col<Row>[] = [
    { header: 'SKU', cell: (r) => r.sku }, { header: 'Producto', cell: (r) => <b>{r.producto}</b> }, { header: 'Almacén', cell: (r) => r.almacen },
    { header: 'Existencias', align: 'right', cell: (r) => <b>{num(r.cantidad, 3)} {r.unidad}</b> }, { header: 'Mínimo', align: 'right', cell: (r) => num(r.stock_minimo, 3) },
    { header: 'Costo prom.', align: 'right', cell: (r) => money(r.costo_promedio) }, { header: 'Valorizado', align: 'right', cell: (r) => money(r.valorizado) },
    { header: 'Reposición', cell: (r) => <Badge value={r.estado} /> },
    { header: '', cell: (r) => can('inventario', 'create') && <Button variant="ghost" title="Ajuste manual" onClick={() => setAdj({ ...r, delta: '', motivo: '' })}><SlidersHorizontal size={15} /></Button> },
  ]
  return (
    <>
      <PageHeader title="Stock de Productos" subtitle="Existencias por almacén con alertas visuales de reposición" actions={<Card className="px-4 py-2 text-sm">Inventario valorizado: <b className="tabular-nums">{money(total)}</b></Card>} />
      <Filters>
        <Field label="Almacén"><select className={inputCls + ' w-56'} value={f.almacen_id} onChange={(e) => setF({ ...f, almacen_id: e.target.value })}><option value="">Todos</option>{alms.map((a) => <option key={a.id} value={a.id}>{labelOf('almacenes', a)}</option>)}</select></Field>
        <Field label="Producto"><input className={inputCls + ' w-56'} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="SKU o nombre" /></Field>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={f.solo_alertas} onChange={(e) => setF({ ...f, solo_alertas: e.target.checked })} /> Solo alertas</label>
      </Filters>
      <DataTable columns={cols} rows={data?.map((r, i) => ({ ...r, id: i }))} loading={isLoading} />
      <Modal open={!!adj} onClose={() => setAdj(null)} size="sm" title={`Ajuste · ${adj?.sku}`}
        footer={<><Button variant="secondary" onClick={() => setAdj(null)}>Cancelar</Button><Button disabled={!adj?.delta || !adj?.motivo || String(adj.motivo).length < 3} loading={ajustar.isPending} onClick={() => ajustar.mutate()}>Registrar ajuste</Button></>}>
        {adj && <div className="space-y-3">
          <p className="text-sm text-slate-600">{adj.producto} · {adj.almacen} · existencias {num(adj.cantidad, 3)}</p>
          <Field label="Cantidad (+ entrada / − salida)"><input type="number" step="0.001" className={inputCls} value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} /></Field>
          <Field label="Motivo *"><input className={inputCls} value={adj.motivo} onChange={(e) => setAdj({ ...adj, motivo: e.target.value })} /></Field></div>}
      </Modal>
    </>
  )
}
