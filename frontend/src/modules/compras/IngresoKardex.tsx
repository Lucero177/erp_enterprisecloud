import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackageCheck } from 'lucide-react'
import { get } from '../../services/api'
import { Badge, Button, Col, DataTable, PageHeader, Tabs } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { fdate, fdatetime, money } from '../../utils/format'
import { Row } from '../../types'
import KardexEntryModal from './KardexEntryModal'

export default function IngresoKardex() {
  const { can } = useAuth()
  const [tab, setTab] = useState('EMITIDO')
  const [sel, setSel] = useState<Row | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['purchases', 'ingreso', tab], queryFn: () => get<{ items: Row[] }>('/purchases', { estado: tab, limit: 200 }) })
  const cols: Col<Row>[] = [
    { header: 'N° OC', cell: (r) => <b>{r.numero_oc}</b> }, { header: 'Fecha', cell: (r) => fdate(r.fecha) }, { header: 'Proveedor', cell: (r) => r.proveedor },
    { header: 'Almacén', cell: (r) => r.almacen }, { header: 'Total', align: 'right', cell: (r) => money(r.total, r.moneda) },
    ...(tab === 'EMITIDO'
      ? [{ header: '', cell: (r: Row) => can('compras', 'approve') && <Button onClick={async () => setSel(await get(`/purchases/${r.id}`))}><PackageCheck size={15} /> Recepcionar</Button> }]
      : [{ header: 'Comprobante', cell: (r: Row) => `${r.tipo_comprobante} ${r.serie_comprobante}-${r.numero_comprobante}` }, { header: 'Ingreso', cell: (r: Row) => fdatetime(r.fecha_ingreso) }, { header: 'Estado', cell: (r: Row) => <Badge value={r.estado} /> }]),
  ]
  return (
    <>
      <PageHeader title="Ingreso al Kardex" subtitle="La orden pasa a recepción física: se validan los datos del comprobante y se confirma el impacto en el almacén" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'EMITIDO', label: 'Pendientes de ingreso' }, { id: 'INGRESADO_CERRADO', label: 'Ingresadas' }]} />
      <DataTable columns={cols} rows={data?.items} loading={isLoading} empty={tab === 'EMITIDO' ? 'No hay órdenes pendientes de recepción' : 'Aún no hay ingresos registrados'} />
      {sel && <KardexEntryModal compra={sel} onClose={() => setSel(null)} />}
    </>
  )
}
