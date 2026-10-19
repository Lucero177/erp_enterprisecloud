import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HandCoins } from 'lucide-react'
import { get, post } from '../../services/api'
import { Badge, Button, Col, DataTable, Field, Filters, Modal, PageHeader, inputCls, useToast } from '../../components/ui'
import { useMaster } from '../../hooks/useLookups'
import { useAuth } from '../../store/auth'
import { errMsg, fdate, money } from '../../utils/format'
import { Row } from '../../types'

export default function Cuentas({ kind }: { kind: 'cxc' | 'cxp' }) {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const { data: fps = [] } = useMaster('formas-pago')
  const [estado, setEstado] = useState('')
  const [pay, setPay] = useState<Row | null>(null)
  const isC = kind === 'cxc'
  const { data, isLoading } = useQuery({ queryKey: [kind, estado], queryFn: () => get<{ items: Row[] }>(`/treasury/${kind}`, { estado }) })
  const m = useMutation({
    mutationFn: () => post(`/treasury/${kind}/${pay!.id}/${isC ? 'cobrar' : 'pagar'}`, { monto: Number(pay!.monto), forma_pago_id: pay!.fp ? Number(pay!.fp) : null }),
    onSuccess: () => { for (const k of [kind, 'caja', 'dashboard']) qc.invalidateQueries({ queryKey: [k] }); toast(isC ? 'Cobro registrado' : 'Pago registrado'); setPay(null) },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  const cols: Col<Row>[] = [
    { header: isC ? 'Cliente' : 'Proveedor', cell: (r) => <b>{isC ? r.cliente : r.proveedor}</b> }, { header: 'Referencia', cell: (r) => r.referencia }, { header: 'Comprobante', cell: (r) => r.comprobante ?? '—' },
    { header: 'Vence', cell: (r) => <span className={r.vencida ? 'font-medium text-red-600' : ''}>{fdate(r.vencimiento)}</span> },
    { header: 'Monto', align: 'right', cell: (r) => money(r.monto_original, r.moneda) }, { header: 'Saldo', align: 'right', cell: (r) => <b>{money(r.saldo, r.moneda)}</b> },
    { header: 'Estado', cell: (r) => <Badge value={r.estado} /> },
    { header: '', cell: (r) => ['PENDIENTE', 'PARCIAL'].includes(r.estado) && can('tesoreria', 'update') && <Button variant="secondary" onClick={() => setPay({ ...r, monto: r.saldo, fp: '' })}><HandCoins size={14} /> {isC ? 'Cobrar' : 'Pagar'}</Button> },
  ]
  return (
    <>
      <PageHeader title={isC ? 'Cuentas por Cobrar (CxC)' : 'Cuentas por Pagar (CxP)'} subtitle={isC ? 'Se generan al facturar; los cobros ingresan a caja' : 'Se generan al ingresar una compra al kardex; los pagos egresan de caja'} />
      <Filters><Field label="Estado"><select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{['PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO'].map((s) => <option key={s}>{s}</option>)}</select></Field></Filters>
      <DataTable columns={cols} rows={data?.items} loading={isLoading} />
      <Modal open={!!pay} onClose={() => setPay(null)} size="sm" title={`${isC ? 'Registrar cobro' : 'Registrar pago'} · ${pay?.referencia}`}
        footer={<><Button variant="secondary" onClick={() => setPay(null)}>Cancelar</Button><Button loading={m.isPending} disabled={!(Number(pay?.monto) > 0)} onClick={() => m.mutate()}>Confirmar</Button></>}>
        {pay && <div className="space-y-3">
          <p className="text-sm text-slate-600">Saldo pendiente: <b>{money(pay.saldo, pay.moneda)}</b></p>
          <Field label="Monto *"><input type="number" step="0.01" className={inputCls} value={pay.monto} onChange={(e) => setPay({ ...pay, monto: e.target.value })} /></Field>
          <Field label="Forma de pago"><select className={inputCls} value={pay.fp} onChange={(e) => setPay({ ...pay, fp: e.target.value })}><option value="">—</option>{fps.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></Field></div>}
      </Modal>
    </>
  )
}
