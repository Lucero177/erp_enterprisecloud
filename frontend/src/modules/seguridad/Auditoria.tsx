import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../services/api'
import { Badge, Col, DataTable, Field, Filters, PageHeader, inputCls } from '../../components/ui'
import { fdatetime } from '../../utils/format'
import { Row } from '../../types'

export default function Auditoria() {
  const [f, setF] = useState({ modulo: '', accion: '', resultado: '', desde: '', hasta: '' })
  const [page, setPage] = useState(0)
  const { data, isLoading } = useQuery({ queryKey: ['audit', f, page], queryFn: () => get<{ items: Row[]; total: number }>('/audit', { ...f, skip: page * 100, limit: 100 }) })
  const cols: Col<Row>[] = [
    { header: 'Fecha / hora', cell: (r) => fdatetime(r.fecha_hora) }, { header: 'Usuario', cell: (r) => r.usuario ?? <span className="text-slate-400">—</span> }, { header: 'Acción', cell: (r) => <b>{r.accion}</b> },
    { header: 'Módulo', cell: (r) => r.modulo }, { header: 'Registro afectado', cell: (r) => r.registro_afectado }, { header: 'Resultado', cell: (r) => <Badge value={r.resultado} /> },
    { header: 'IP', cell: (r) => r.ip_origen ?? '' }, { header: 'Detalle', cell: (r) => <span className="block max-w-xs truncate text-xs text-slate-500" title={r.detalle ? JSON.stringify(r.detalle) : ''}>{r.detalle ? JSON.stringify(r.detalle) : ''}</span> },
  ]
  const set = (k: string, v: string) => { setPage(0); setF({ ...f, [k]: v }) }
  return (
    <>
      <PageHeader title="Registro de Auditoría" subtitle="Operaciones críticas: usuario, acción, módulo, registro afectado, fecha/hora y resultado" />
      <Filters>
        <Field label="Módulo"><input className={inputCls + ' w-40'} placeholder="compras, ventas…" value={f.modulo} onChange={(e) => set('modulo', e.target.value)} /></Field>
        <Field label="Acción"><input className={inputCls + ' w-40'} placeholder="INSERT, FACTURAR…" value={f.accion} onChange={(e) => set('accion', e.target.value.toUpperCase())} /></Field>
        <Field label="Resultado"><select className={inputCls} value={f.resultado} onChange={(e) => set('resultado', e.target.value)}><option value="">Todos</option>{['EXITO', 'FALLO', 'DENEGADO'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Desde"><input type="date" className={inputCls} value={f.desde} onChange={(e) => set('desde', e.target.value)} /></Field>
        <Field label="Hasta"><input type="date" className={inputCls} value={f.hasta} onChange={(e) => set('hasta', e.target.value)} /></Field>
      </Filters>
      <DataTable columns={cols} rows={data?.items} loading={isLoading} />
      {data && <div className="mt-3 flex items-center justify-between text-sm text-slate-500"><span>{data.total} registros</span>
        <div className="flex gap-2"><button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
          <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={(page + 1) * 100 >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>}
    </>
  )
}
