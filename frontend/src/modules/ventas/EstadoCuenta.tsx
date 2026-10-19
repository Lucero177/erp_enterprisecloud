import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../services/api'
import { Badge, Card, Col, DataTable, Field, PageHeader, inputCls } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { fdate, money } from '../../utils/format'
import { Row } from '../../types'

export default function EstadoCuenta() {
  const { data: clientes = [] } = useMaster('clientes')
  const [cid, setCid] = useState('')
  const { data: resumen } = useQuery({ queryKey: ['sales', 'ec-resumen'], queryFn: () => get<Row[]>('/sales/estado-cuenta') })
  const { data: ec } = useQuery({ queryKey: ['sales', 'ec', cid], queryFn: () => get(`/sales/estado-cuenta/${cid}`), enabled: !!cid })
  const cols: Col<Row>[] = [
    { header: 'Comprobante', cell: (r) => <b>{r.comprobante ?? r.numero_ov}</b> }, { header: 'Fecha', cell: (r) => fdate(r.fecha) }, { header: 'Vence', cell: (r) => <span className={r.vencida ? 'font-medium text-red-600' : ''}>{fdate(r.vencimiento)}</span> },
    { header: 'Monto', align: 'right', cell: (r) => money(r.monto_original) }, { header: 'Saldo', align: 'right', cell: (r) => <b>{money(r.saldo)}</b> },
    { header: 'Estado', cell: (r) => <Badge value={r.estado} /> }, { header: '', cell: (r) => r.vencida && <Badge value="DENEGADO" /> },
  ]
  return (
    <>
      <PageHeader title="Estado de Cuenta" subtitle="Créditos, saldos y vencimientos por cliente" />
      <Field label="Cliente" className="mb-4 max-w-md"><select className={inputCls} value={cid} onChange={(e) => setCid(e.target.value)}><option value="">— Resumen de clientes con saldo —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{labelOf('clientes', c)}</option>)}</select></Field>
      {!cid ? (
        <DataTable columns={[{ header: 'Cliente', cell: (r: Row) => <button className="text-indigo-600 hover:underline" onClick={() => setCid(String(r.cliente_id))}>{r.cliente}</button> }, { header: 'Documento', cell: (r: Row) => r.documento },
          { header: 'Límite de crédito', align: 'right', cell: (r: Row) => (Number(r.limite_credito) > 0 ? money(r.limite_credito) : 'Sin límite') }, { header: 'Saldo pendiente', align: 'right', cell: (r: Row) => <b>{money(r.saldo_pendiente)}</b> }]}
          rows={resumen?.map((r, i) => ({ ...r, id: i }))} empty="Ningún cliente tiene saldo pendiente" />
      ) : ec && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[['Saldo pendiente', money(ec.saldo_pendiente), ''], ['Saldo vencido', money(ec.saldo_vencido), Number(ec.saldo_vencido) > 0 ? 'text-red-600' : ''],
              ['Límite de crédito', Number(ec.cliente.limite_credito) > 0 ? money(ec.cliente.limite_credito) : 'Sin límite', ''], ['Crédito disponible', ec.credito_disponible == null ? '—' : money(ec.credito_disponible), '']].map(([l, v, c]) => (
              <Card key={l} className="p-4"><div className="text-xs uppercase text-slate-500">{l}</div><div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{v}</div></Card>))}
          </div>
          <DataTable columns={cols} rows={ec.documentos} empty="El cliente no tiene documentos a crédito" />
        </>
      )}
    </>
  )
}
