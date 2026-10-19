import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { get, post } from '../../services/api'
import { Badge, Button, Card, Col, DataTable, Field, Modal, PageHeader, inputCls, useToast } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { useAuth } from '../../store/auth'
import { errMsg, fdatetime, money } from '../../utils/format'
import { Row } from '../../types'

export default function Caja() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const { data: monedas = [] } = useMaster('monedas')
  const [mov, setMov] = useState<Row | null>(null)
  const { data: movs, isLoading } = useQuery({ queryKey: ['caja', 'mov'], queryFn: () => get<{ items: Row[] }>('/treasury/caja') })
  const { data: resumen = [] } = useQuery({ queryKey: ['caja', 'res'], queryFn: () => get<Row[]>('/treasury/caja/resumen') })
  const m = useMutation({
    mutationFn: () => post('/treasury/caja', { tipo: mov!.tipo, monto: Number(mov!.monto), moneda_id: Number(mov!.moneda_id), concepto: mov!.concepto }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caja'] }); toast('Movimiento registrado'); setMov(null) }, onError: (e) => toast(errMsg(e), 'error'),
  })
  const cols: Col<Row>[] = [
    { header: 'Fecha', cell: (r) => fdatetime(r.fecha) }, { header: 'Tipo', cell: (r) => <Badge value={r.tipo} /> }, { header: 'Concepto', cell: (r) => r.concepto },
    { header: 'Monto', align: 'right', cell: (r) => <b className={r.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-rose-600'}>{r.tipo === 'INGRESO' ? '+' : '−'}{money(r.monto, r.moneda)}</b> },
  ]
  return (
    <>
      <PageHeader title="Caja" subtitle="Control de ingresos y egresos" actions={can('tesoreria', 'create') && <Button onClick={() => setMov({ tipo: 'INGRESO', monto: '', moneda_id: monedas[0]?.id ?? '', concepto: '' })}><Plus size={16} /> Nuevo movimiento</Button>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resumen.length === 0 && <Card className="p-4 text-sm text-slate-400">Sin movimientos</Card>}
        {resumen.map((r) => (
          <Card key={r.moneda} className="p-4"><div className="text-xs uppercase text-slate-500">Saldo de caja · {r.moneda}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{money(r.saldo)}</div>
            <div className="mt-1 text-xs text-slate-500">Ingresos {money(r.ingresos)} · Egresos {money(r.egresos)}</div></Card>))}
      </div>
      <DataTable columns={cols} rows={movs?.items} loading={isLoading} />
      <Modal open={!!mov} onClose={() => setMov(null)} size="sm" title="Nuevo movimiento de caja"
        footer={<><Button variant="secondary" onClick={() => setMov(null)}>Cancelar</Button><Button loading={m.isPending} disabled={!(Number(mov?.monto) > 0) || String(mov?.concepto ?? '').length < 3} onClick={() => m.mutate()}>Registrar</Button></>}>
        {mov && <div className="space-y-3">
          <Field label="Tipo"><select className={inputCls} value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value })}><option value="INGRESO">Ingreso</option><option value="EGRESO">Egreso</option></select></Field>
          <Field label="Moneda"><select className={inputCls} value={mov.moneda_id} onChange={(e) => setMov({ ...mov, moneda_id: e.target.value })}>{monedas.map((x) => <option key={x.id} value={x.id}>{labelOf('monedas', x)}</option>)}</select></Field>
          <Field label="Monto *"><input type="number" step="0.01" className={inputCls} value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} /></Field>
          <Field label="Concepto *"><input className={inputCls} value={mov.concepto} onChange={(e) => setMov({ ...mov, concepto: e.target.value })} /></Field></div>}
      </Modal>
    </>
  )
}
