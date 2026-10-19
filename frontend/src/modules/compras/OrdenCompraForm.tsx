import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { post } from '../../services/api'
import { Button, Card, Field, PageHeader, inputCls, useToast } from '../../components/ui'
import LineasEditor, { emptyLinea } from '../../components/LineasEditor'
import { useMaster, labelOf } from '../../hooks/useLookups'
import { errMsg, today } from '../../utils/format'
import { Linea } from '../../types'

export default function OrdenCompraForm() {
  const nav = useNavigate()
  const toast = useToast()
  const { data: provs = [] } = useMaster('proveedores')
  const { data: alms = [] } = useMaster('almacenes')
  const { data: monedas = [] } = useMaster('monedas')
  const { data: fps = [] } = useMaster('formas-pago')
  const [h, setH] = useState({ proveedor_id: '', almacen_id: '', moneda_id: '', forma_pago_id: '', fecha: today(), observaciones: '' })
  const [lineas, setLineas] = useState<Linea[]>([emptyLinea()])
  const cur = monedas.find((m) => m.id === Number(h.moneda_id))?.simbolo ?? ''

  const save = useMutation({
    mutationFn: (emitir: boolean) => post('/purchases', {
      proveedor_id: Number(h.proveedor_id), almacen_id: Number(h.almacen_id), moneda_id: Number(h.moneda_id),
      forma_pago_id: h.forma_pago_id ? Number(h.forma_pago_id) : null, fecha: h.fecha || null, observaciones: h.observaciones || null, emitir,
      lineas: lineas.filter((l) => l.producto_id !== '').map((l) => ({ producto_id: Number(l.producto_id), cantidad: l.cantidad, precio_unitario: l.precio_unitario })),
    }),
    onSuccess: (r) => { toast(`Orden ${r.numero_oc} ${r.estado === 'EMITIDO' ? 'emitida' : 'guardada como borrador'}`); nav('/compras/ordenes') },
    onError: (e) => toast(errMsg(e), 'error'),
  })
  const ok = h.proveedor_id && h.almacen_id && h.moneda_id && lineas.some((l) => l.producto_id !== '' && l.cantidad > 0)

  return (
    <>
      <PageHeader title="Nueva Orden de Compra" subtitle="Complete la cabecera y las líneas; los subtotales e impuestos se calculan automáticamente"
        actions={<><Button variant="secondary" onClick={() => nav('/compras/ordenes')}>Cancelar</Button>
          <Button variant="secondary" disabled={!ok} loading={save.isPending} onClick={() => save.mutate(false)}>Guardar borrador</Button>
          <Button disabled={!ok} loading={save.isPending} onClick={() => save.mutate(true)}>Emitir orden</Button></>} />
      <Card className="mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Proveedor *"><select className={inputCls} value={h.proveedor_id} onChange={(e) => {
          const p = provs.find((x) => x.id === Number(e.target.value)); setH({ ...h, proveedor_id: e.target.value, forma_pago_id: p?.forma_pago_id ? String(p.forma_pago_id) : h.forma_pago_id })
        }}><option value="">— Seleccione —</option>{provs.filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{labelOf('proveedores', p)}</option>)}</select></Field>
        <Field label="Almacén receptor *"><select className={inputCls} value={h.almacen_id} onChange={(e) => setH({ ...h, almacen_id: e.target.value })}>
          <option value="">— Seleccione —</option>{alms.filter((a) => a.activo).map((a) => <option key={a.id} value={a.id}>{labelOf('almacenes', a)}</option>)}</select></Field>
        <Field label="Moneda *"><select className={inputCls} value={h.moneda_id} onChange={(e) => setH({ ...h, moneda_id: e.target.value })}>
          <option value="">— Seleccione —</option>{monedas.map((m) => <option key={m.id} value={m.id}>{labelOf('monedas', m)}</option>)}</select></Field>
        <Field label="Forma de pago"><select className={inputCls} value={h.forma_pago_id} onChange={(e) => setH({ ...h, forma_pago_id: e.target.value })}>
          <option value="">— Seleccione —</option>{fps.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" className={inputCls} value={h.fecha} onChange={(e) => setH({ ...h, fecha: e.target.value })} /></Field>
        <Field label="Observaciones" className="sm:col-span-2 lg:col-span-3"><input className={inputCls} value={h.observaciones} maxLength={300} onChange={(e) => setH({ ...h, observaciones: e.target.value })} /></Field>
      </Card>
      <Card className="p-4"><LineasEditor lineas={lineas} onChange={setLineas} currency={cur} priceFrom="costo" /></Card>
    </>
  )
}
