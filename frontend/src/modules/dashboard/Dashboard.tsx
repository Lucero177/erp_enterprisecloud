import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, ShoppingCart, TrendingUp } from 'lucide-react'
import { get } from '../../services/api'
import { Card, PageHeader, Spinner } from '../../components/ui'
import { money, num } from '../../utils/format'

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`rounded-lg p-2 ${tone}`}><Icon size={18} /></span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </Card>
  )
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => get('/dashboard'), refetchInterval: 60_000 })
  if (isLoading || !data) return <Spinner />
  const k = data.kpis
  return (
    <>
      <PageHeader title="Panel de Control" subtitle="Resumen comercial, de inventario y financiero (importes en la moneda registrada de cada documento)" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Ventas del mes" value={money(k.ventas_mes)} icon={TrendingUp} tone="bg-emerald-100 text-emerald-700" />
        <Kpi label="Compras del mes" value={money(k.compras_mes)} icon={ShoppingCart} tone="bg-blue-100 text-blue-700" />
        <Kpi label="Inventario valorizado" value={money(k.inventario_valorizado)} icon={Boxes} tone="bg-violet-100 text-violet-700" />
        <Kpi label="Por cobrar (CxC)" value={money(k.cxc_pendiente)} icon={ArrowDownCircle} tone="bg-amber-100 text-amber-700" />
        <Kpi label="Por pagar (CxP)" value={money(k.cxp_pendiente)} icon={ArrowUpCircle} tone="bg-rose-100 text-rose-700" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Evolución de ventas vs. compras (últimos 6 meses)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => num(v, 0)} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#059669" strokeWidth={2.5} dot />
                <Line type="monotone" dataKey="compras" name="Compras" stroke="#2563eb" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><AlertTriangle size={16} className="text-amber-500" /> Alertas de stock mínimo</h3>
          {data.alertas_stock.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Sin productos bajo el mínimo</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.alertas_stock.map((a: any, i: number) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <div><div className="font-medium text-slate-800">{a.producto}</div><div className="text-xs text-slate-500">{a.sku} · {a.almacen}</div></div>
                  <div className="text-right"><div className={`font-semibold tabular-nums ${Number(a.cantidad) <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{num(a.cantidad, 0)}</div><div className="text-xs text-slate-400">mín. {num(a.stock_minimo, 0)}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Comparativo mensual</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => num(v, 0)} />
              <Tooltip formatter={(v: number) => money(v)} /><Legend />
              <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="compras" name="Compras" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}
