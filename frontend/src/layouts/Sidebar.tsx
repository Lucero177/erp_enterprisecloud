import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, LayoutDashboard, Database, ShoppingCart, Receipt, Boxes, Wallet, ShieldCheck } from 'lucide-react'
import { useAuth } from '../store/auth'
import { cn } from '../components/ui'

interface Item { to: string; label: string }
interface Group { title?: string; items: Item[] }
interface Section { id: string; label: string; icon: React.ElementType; modulo: string; to?: string; groups?: Group[] }

export const SECTIONS: Section[] = [
  { id: 'inicio', label: 'Inicio', icon: LayoutDashboard, modulo: 'dashboard', to: '/' },
  {
    id: 'maestros', label: 'Maestros', icon: Database, modulo: 'maestros',
    groups: [
      { title: 'Organización', items: [
        { to: '/maestros/empresas', label: 'Empresas' }, { to: '/maestros/sucursales', label: 'Sucursales' }, { to: '/maestros/almacenes', label: 'Almacenes' }] },
      { title: 'Comercial', items: [
        { to: '/maestros/clientes', label: 'Clientes' }, { to: '/maestros/proveedores', label: 'Proveedores' }, { to: '/maestros/transportistas', label: 'Transportistas' },
        { to: '/maestros/vendedores', label: 'Vendedores' }, { to: '/maestros/zonas', label: 'Zonas' }] },
      { title: 'Inventario', items: [
        { to: '/maestros/productos', label: 'Productos' }, { to: '/maestros/categorias', label: 'Categorías' }, { to: '/maestros/marcas', label: 'Marcas' },
        { to: '/maestros/unidades-medida', label: 'Unidades de medida' }, { to: '/maestros/conversion-unidades', label: 'Conversión de unidades' }] },
      { title: 'Finanzas', items: [
        { to: '/maestros/monedas', label: 'Monedas y tipos de cambio' }, { to: '/maestros/impuestos', label: 'Impuestos (IGV)' },
        { to: '/maestros/formas-pago', label: 'Formas de pago' }, { to: '/maestros/listas-precios', label: 'Listas de precios' }] },
    ],
  },
  { id: 'compras', label: 'Compras', icon: ShoppingCart, modulo: 'compras',
    groups: [{ items: [{ to: '/compras/ordenes', label: 'Orden de Compra' }, { to: '/compras/ingreso-kardex', label: 'Ingreso al Kardex' }] }] },
  { id: 'ventas', label: 'Ventas', icon: Receipt, modulo: 'ventas',
    groups: [{ items: [{ to: '/ventas/cotizaciones', label: 'Cotización' }, { to: '/ventas/ordenes', label: 'Orden de Venta' },
      { to: '/ventas/facturacion', label: 'Facturación' }, { to: '/ventas/estado-cuenta', label: 'Estado de Cuenta' }] }] },
  { id: 'inventario', label: 'Inventario y Kardex', icon: Boxes, modulo: 'inventario',
    groups: [{ items: [{ to: '/inventario/stock', label: 'Stock de Productos' }, { to: '/inventario/kardex', label: 'Movimientos de Kardex' }] }] },
  { id: 'tesoreria', label: 'Tesorería / Finanzas', icon: Wallet, modulo: 'tesoreria',
    groups: [{ items: [{ to: '/tesoreria/cxc', label: 'Cuentas por Cobrar (CxC)' }, { to: '/tesoreria/cxp', label: 'Cuentas por Pagar (CxP)' },
      { to: '/tesoreria/caja', label: 'Caja (ingresos / egresos)' }] }] },
  { id: 'seguridad', label: 'Seguridad y Auditoría', icon: ShieldCheck, modulo: 'seguridad',
    groups: [{ items: [{ to: '/seguridad/usuarios', label: 'Usuarios y Roles' }, { to: '/seguridad/auditoria', label: 'Registro de Auditoría' }] }] },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const isOpen = (s: Section) => open[s.id] ?? (s.groups?.some((g) => g.items.some((i) => pathname.startsWith(i.to))) ?? false)

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {SECTIONS.filter((s) => can(s.modulo === 'seguridad' ? 'seguridad' : s.modulo) || (s.id === 'seguridad' && can('auditoria'))).map((s) => {
        const Icon = s.icon
        if (s.to) {
          return (
            <NavLink key={s.id} to={s.to} end onClick={onNavigate}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800')}>
              <Icon size={18} /> {s.label}
            </NavLink>
          )
        }
        const o = isOpen(s)
        return (
          <div key={s.id}>
            <button onClick={() => setOpen((p) => ({ ...p, [s.id]: !o }))}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800">
              <Icon size={18} /> <span className="flex-1 text-left">{s.label}</span>
              {o ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {o && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                {s.groups?.map((g, gi) => (
                  <div key={gi} className="pb-1">
                    {g.title && <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.title}</div>}
                    {g.items.map((it) => (
                      <NavLink key={it.to} to={it.to} onClick={onNavigate}
                        className={({ isActive }) => cn('block rounded-md px-2 py-1.5 text-[13px]', isActive ? 'bg-slate-800 font-medium text-white' : 'text-slate-400 hover:text-white')}>
                        {it.label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
