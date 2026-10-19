import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Pencil, Plus, Trash2 } from 'lucide-react'
import { del, get, post, put } from '../../services/api'
import { Badge, Button, Col, DataTable, Field, Filters, Modal, PageHeader, Tabs, inputCls, useToast } from '../../components/ui'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { useAuth } from '../../store/auth'
import { errMsg, fdate, num } from '../../utils/format'
import { Row } from '../../types'
import { FieldDef, MASTER_BY_SLUG, MasterDef } from './masters.config'

function SelectOptions({ slug }: { slug: string }) {
  const { data } = useMaster(slug)
  return <>{data?.map((r) => <option key={r.id} value={r.id}>{labelOf(slug, r)}</option>)}</>
}

function Cell({ f, row }: { f: FieldDef; row: Row }) {
  const v = row[f.key]
  const { data } = useMaster(f.optionsFrom ?? 'zonas', !!f.optionsFrom)
  if (f.type === 'select') {
    if (!v) return <span className="text-slate-300">—</span>
    const r = f.optionsFrom ? data?.find((x) => x.id === v) : undefined
    return <>{r ? labelOf(f.optionsFrom!, r) : v}</>
  }
  if (f.type === 'bool') return <Badge value={v ? 'OK' : 'ANULADO'} />
  if (f.type === 'number') return <>{num(v, f.step && f.step !== '1' ? Math.min(4, f.step.split('.')[1]?.length ?? 2) : 0)}</>
  if (f.type === 'date') return <>{fdate(v)}</>
  return <>{v ?? <span className="text-slate-300">—</span>}</>
}

export default function MasterPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const def = MASTER_BY_SLUG[slug]
  const { user, can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Row | null>(null)
  const [pricesFor, setPricesFor] = useState<Row | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['master', slug, 'page', q], queryFn: () => get<{ items: Row[] }>(`/${slug}`, { q, limit: 1000 }).then((r) => r.items), enabled: !!def })
  const initial = useMemo(() => Object.fromEntries((def?.fields ?? []).map((f) => [f.key, f.default ?? (f.type === 'bool' ? true : '')])), [def])

  const save = useMutation({
    mutationFn: (body: Row) => {
      const payload: Row = {}
      for (const f of def.fields) {
        const v = body[f.key]
        if (v === '' || v === undefined) { if (body.id) payload[f.key] = null; continue }
        payload[f.key] = f.type === 'number' || f.type === 'select' ? Number(v) : v
      }
      if (def.injectEmpresa && !body.id) payload.empresa_id = user!.empresa_id
      return body.id ? put(`/${slug}/${body.id}`, payload) : post(`/${slug}`, payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master', slug] }); setEdit(null); toast('Guardado correctamente') },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => del(`/${slug}/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master', slug] }); toast('Registro eliminado / desactivado') },
    onError: (e) => toast(errMsg(e), 'error'),
  })

  if (!def) return <p className="text-slate-500">Maestro no encontrado.</p>
  const columns: Col<Row>[] = [
    ...def.fields.filter((f) => !f.hideInTable).map((f) => ({ header: f.label, cell: (r: Row) => <Cell f={f} row={r} />, align: f.type === 'number' ? ('right' as const) : undefined })),
    { header: '', align: 'right', cell: (r) => (
      <div className="flex justify-end gap-1">
        {def.prices && can('maestros', 'update') && <Button variant="ghost" title="Precios" onClick={() => setPricesFor(r)}><DollarSign size={15} /></Button>}
        {can('maestros', 'update') && <Button variant="ghost" title="Editar" onClick={() => setEdit({ ...initial, ...r })}><Pencil size={15} /></Button>}
        {can('maestros', 'delete') && <Button variant="ghost" title="Eliminar" onClick={() => confirm('¿Eliminar / desactivar este registro?') && remove.mutate(r.id)}><Trash2 size={15} className="text-red-500" /></Button>}
      </div>) },
  ]

  return (
    <>
      <PageHeader title={def.title} subtitle={def.subtitle}
        actions={can('maestros', 'create') && <Button onClick={() => setEdit({ ...initial })}><Plus size={16} /> Nuevo</Button>} />
      {def.tabGroup && (
        <Tabs tabs={def.tabGroup.map((s) => ({ id: s, label: MASTER_BY_SLUG[s].title }))} value={slug}
          onChange={(s) => navigate(`/maestros/${s}`)} />
      )}
      <Filters><input className={inputCls + ' max-w-xs'} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></Filters>
      <DataTable columns={columns} rows={data} loading={isLoading} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? 'Editar' : 'Nuevo'} · ${def.title}`}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button loading={save.isPending} onClick={() => edit && save.mutate(edit)}>Guardar</Button></>}>
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {def.fields.map((f) => (
              <Field key={f.key} label={f.label + (f.required ? ' *' : '')} hint={f.hint}>
                {f.type === 'bool' ? (
                  <input type="checkbox" className="h-4 w-4" checked={!!edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.checked })} />
                ) : f.type === 'select' ? (
                  <select className={inputCls} value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}>
                    <option value="">— Seleccione —</option><SelectOptions slug={f.optionsFrom!} />
                  </select>
                ) : (
                  <input className={inputCls} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
                    step={f.step ?? (f.type === 'number' ? '0.01' : undefined)} value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
          </div>
        )}
      </Modal>
      {pricesFor && <PricesModal lista={pricesFor} onClose={() => setPricesFor(null)} />}
    </>
  )
}

function PricesModal({ lista, onClose }: { lista: Row; onClose: () => void }) {
  const toast = useToast()
  const { data: productos } = useMaster('productos')
  const [rows, setRows] = useState<{ producto_id: number | ''; precio: number | '' }[] | null>(null)
  useQuery({
    queryKey: ['precios', lista.id],
    queryFn: async () => { const r = await get(`/listas-precios/${lista.id}/detalle`); setRows(r.map((x: Row) => ({ producto_id: x.producto_id, precio: Number(x.precio) }))); return r },
  })
  const save = useMutation({
    mutationFn: () => put(`/listas-precios/${lista.id}/detalle`, (rows ?? []).filter((r) => r.producto_id !== '' && r.precio !== '').map((r) => ({ producto_id: Number(r.producto_id), precio: Number(r.precio) }))),
    onSuccess: () => { toast('Precios guardados'); onClose() }, onError: (e) => toast(errMsg(e), 'error'),
  })
  return (
    <Modal open onClose={onClose} title={`Precios · ${lista.nombre}`} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cerrar</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Guardar precios</Button></>}>
      <div className="space-y-2">
        {(rows ?? []).map((r, i) => (
          <div key={i} className="flex gap-2">
            <select className={inputCls} value={r.producto_id} onChange={(e) => setRows(rows!.map((x, j) => (j === i ? { ...x, producto_id: Number(e.target.value) } : x)))}>
              <option value="">— Producto —</option>{productos?.map((p) => <option key={p.id} value={p.id}>{labelOf('productos', p)}</option>)}
            </select>
            <input type="number" step="0.0001" className={inputCls + ' w-36'} value={r.precio} onChange={(e) => setRows(rows!.map((x, j) => (j === i ? { ...x, precio: e.target.value === '' ? '' : Number(e.target.value) } : x)))} />
            <Button variant="ghost" onClick={() => setRows(rows!.filter((_, j) => j !== i))}><Trash2 size={15} className="text-red-500" /></Button>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setRows([...(rows ?? []), { producto_id: '', precio: '' }])}><Plus size={14} /> Agregar producto</Button>
      </div>
    </Modal>
  )
}
