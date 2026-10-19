import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../services/api'
import { Badge, Col, DataTable, Field, Filters, PageHeader, inputCls } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { fdatetime, money, num } from '../../utils/format'
import { Row } from '../../types'

export default function Kardex() {
  const { data: prods = [] } = useMaster('productos')
  const { data: alms = [] } = useMaster('almacenes')
  const [f, setF] = useState({ producto_id: '', almacen_id: '', tipo: '', desde: '', hasta: '' })
  const { data, isLoading } = useQuery({ queryKey: ['kardex', f], queryFn: () => get<{ items: Row[]; total: number }>('/inventory/kardex', f) })
  const cols: Col<Row>[] = [
    { header: 'Fecha', cell: (r) => fdatetime(r.fecha) }, { header: 'Tipo', cell: (r) => <Badge value={r.tipo} /> }, { header: 'Producto', cell: (r) => `${r.sku} · ${r.producto}` }, { header: 'Almacén', cell: (r) => r.almacen },
    { header: 'Cantidad', align: 'right', cell: (r) => <span className={Number(r.cantidad) < 0 ? 'text-rose-600' : 'text-emerald-600'}>{Number(r.cantidad) > 0 ? '+' : ''}{num(r.cantidad, 3)}</span> },
    { header: 'Costo unit.', align: 'right', cell: (r) => money(r.costo_unitario) }, { header: 'Saldo', align: 'right', cell: (r) => <b>{num(r.saldo_cantidad, 3)}</b> },
    { header: 'Saldo valorizado', align: 'right', cell: (r) => money(r.saldo_valorizado) }, { header: 'Origen', cell: (r) => (r.compra_id ? `Compra #${r.compra_id}` : r.venta_id ? `Venta #${r.venta_id}` : r.motivo ?? '') },
  ]
  return (
    <>
      <PageHeader title="Movimientos de Kardex" subtitle="Trazabilidad de entradas, salidas y saldos valorizados" />
      <Filters>
        <Field label="Producto"><select className={inputCls + ' w-64'} value={f.producto_id} onChange={(e) => setF({ ...f, producto_id: e.target.value })}><option value="">Todos</option>{prods.map((p) => <option key={p.id} value={p.id}>{labelOf('productos', p)}</option>)}</select></Field>
        <Field label="Almacén"><select className={inputCls + ' w-48'} value={f.almacen_id} onChange={(e) => setF({ ...f, almacen_id: e.target.value })}><option value="">Todos</option>{alms.map((a) => <option key={a.id} value={a.id}>{labelOf('almacenes', a)}</option>)}</select></Field>
        <Field label="Tipo"><select className={inputCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Todos</option>{['ENTRADA', 'SALIDA', 'AJUSTE'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Desde"><input type="date" className={inputCls} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></Field>
      </Filters>
      <DataTable columns={cols} rows={data?.items} loading={isLoading} />
      {data && <p className="mt-2 text-xs text-slate-400">{data.items.length} de {data.total} movimientos</p>}
    </>
  )
}
