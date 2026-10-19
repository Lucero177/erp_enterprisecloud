import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { post } from '../../services/api'
import { Button, Field, Modal, inputCls, useToast } from '../../components/ui'
import LineasEditor, { emptyLinea } from '../../components/LineasEditor'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { errMsg } from '../../utils/format'
import { Linea } from '../../types'

/** Formulario compartido: Cotización (kind="cotizacion") u Orden de venta (kind="orden"). */
export default function VentaForm({ kind, onClose }: { kind: 'cotizacion' | 'orden'; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: clientes = [] } = useMaster('clientes')
  const { data: monedas = [] } = useMaster('monedas')
  const { data: alms = [] } = useMaster('almacenes')
  const { data: trans = [] } = useMaster('transportistas')
  const [h, setH] = useState({ cliente_id: '', moneda_id: '', almacen_id: '', transportista_id: '', vigencia_hasta: '' })
  const [lineas, setLineas] = useState<Linea[]>([emptyLinea()])
  const cur = monedas.find((m) => m.id === Number(h.moneda_id))?.simbolo ?? ''

  const save = useMutation({
    mutationFn: () => {
      const l = lineas.filter((x) => x.producto_id !== '').map((x) => ({ ...x, producto_id: Number(x.producto_id) }))
      return kind === 'cotizacion'
        ? post('/sales/cotizaciones', { cliente_id: Number(h.cliente_id), moneda_id: Number(h.moneda_id), vigencia_hasta: h.vigencia_hasta || null, emitir: true, lineas: l })
        : post('/sales/ordenes', { cliente_id: Number(h.cliente_id), moneda_id: Number(h.moneda_id), almacen_id: Number(h.almacen_id), transportista_id: h.transportista_id ? Number(h.transportista_id) : null, emitir: true, lineas: l })
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['sales'] }); toast(`${r.numero ?? r.numero_ov} registrada`); onClose() },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  const ok = h.cliente_id && h.moneda_id && (kind === 'cotizacion' || h.almacen_id) && lineas.some((l) => l.producto_id !== '' && l.cantidad > 0)

  return (
    <Modal open onClose={onClose} size="xl" title={kind === 'cotizacion' ? 'Nueva cotización' : 'Nueva orden de venta'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!ok} loading={save.isPending} onClick={() => save.mutate()}>Emitir</Button></>}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cliente *" className="lg:col-span-2"><select className={inputCls} value={h.cliente_id} onChange={(e) => setH({ ...h, cliente_id: e.target.value })}>
          <option value="">— Seleccione —</option>{clientes.filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{labelOf('clientes', c)}</option>)}</select></Field>
        <Field label="Moneda *"><select className={inputCls} value={h.moneda_id} onChange={(e) => setH({ ...h, moneda_id: e.target.value })}>
          <option value="">— Seleccione —</option>{monedas.map((m) => <option key={m.id} value={m.id}>{labelOf('monedas', m)}</option>)}</select></Field>
        {kind === 'cotizacion' ? (
          <Field label="Vigente hasta"><input type="date" className={inputCls} value={h.vigencia_hasta} onChange={(e) => setH({ ...h, vigencia_hasta: e.target.value })} /></Field>
        ) : (<>
          <Field label="Almacén de despacho *"><select className={inputCls} value={h.almacen_id} onChange={(e) => setH({ ...h, almacen_id: e.target.value })}>
            <option value="">— Seleccione —</option>{alms.map((a) => <option key={a.id} value={a.id}>{labelOf('almacenes', a)}</option>)}</select></Field>
          <Field label="Transportista"><select className={inputCls} value={h.transportista_id} onChange={(e) => setH({ ...h, transportista_id: e.target.value })}>
            <option value="">—</option>{trans.map((t) => <option key={t.id} value={t.id}>{labelOf('transportistas', t)}</option>)}</select></Field>
        </>)}
      </div>
      <LineasEditor lineas={lineas} onChange={setLineas} showDiscount currency={cur} />
    </Modal>
  )
}
