import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../services/api'
import { DataTable, PageHeader, Tabs } from '../../components/ui'
import { Row } from '../../types'
import { ventaCols } from './OrdenesVenta'
import VentaDetalleModal from './VentaDetalleModal'

export default function Facturacion() {
  const [tab, setTab] = useState('EMITIDO')
  const [sel, setSel] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['sales', 'fact', tab], queryFn: () => get<{ items: Row[] }>('/sales/ordenes', { estado: tab }) })
  return (
    <>
      <PageHeader title="Facturación" subtitle="Emisión de comprobantes: descuenta stock del almacén y genera la cuenta por cobrar" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'EMITIDO', label: 'Pendientes de facturar' }, { id: 'FACTURADO', label: 'Comprobantes emitidos' }]} />
      <DataTable columns={ventaCols(setSel)} rows={data?.items} loading={isLoading} onRowClick={(r) => setSel(r.id)} empty="Sin documentos" />
      {sel && <VentaDetalleModal id={sel} onClose={() => setSel(null)} />}
    </>
  )
}
