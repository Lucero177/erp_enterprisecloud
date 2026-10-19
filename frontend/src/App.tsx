import { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Spinner } from './components/ui'
import MainLayout from './layouts/MainLayout'
import Login from './modules/Login'
import Dashboard from './modules/dashboard/Dashboard'
import MasterPage from './modules/maestros/MasterPage'
import OrdenCompraList from './modules/compras/OrdenCompraList'
import OrdenCompraForm from './modules/compras/OrdenCompraForm'
import IngresoKardex from './modules/compras/IngresoKardex'
import Cotizaciones from './modules/ventas/Cotizaciones'
import OrdenesVenta from './modules/ventas/OrdenesVenta'
import Facturacion from './modules/ventas/Facturacion'
import EstadoCuenta from './modules/ventas/EstadoCuenta'
import Stock from './modules/inventario/Stock'
import Kardex from './modules/inventario/Kardex'
import Cuentas from './modules/tesoreria/Cuentas'
import Caja from './modules/tesoreria/Caja'
import Usuarios from './modules/seguridad/Usuarios'
import Auditoria from './modules/seguridad/Auditoria'

function Guard({ modulo, children }: { modulo: string; children: ReactNode }) {
  const { can } = useAuth()
  return can(modulo) ? <>{children}</> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">No tiene permiso para acceder a este módulo.</div>
}

export default function App() {
  const { user, loading, can } = useAuth()
  if (loading) return <Spinner />
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={user ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route index element={can('dashboard') ? <Dashboard /> : <Navigate to="/ventas/ordenes" replace />} />
        <Route path="maestros/:slug" element={<Guard modulo="maestros"><MasterPage /></Guard>} />
        <Route path="compras/ordenes" element={<Guard modulo="compras"><OrdenCompraList /></Guard>} />
        <Route path="compras/ordenes/nueva" element={<Guard modulo="compras"><OrdenCompraForm /></Guard>} />
        <Route path="compras/ingreso-kardex" element={<Guard modulo="compras"><IngresoKardex /></Guard>} />
        <Route path="ventas/cotizaciones" element={<Guard modulo="ventas"><Cotizaciones /></Guard>} />
        <Route path="ventas/ordenes" element={<Guard modulo="ventas"><OrdenesVenta /></Guard>} />
        <Route path="ventas/facturacion" element={<Guard modulo="ventas"><Facturacion /></Guard>} />
        <Route path="ventas/estado-cuenta" element={<Guard modulo="ventas"><EstadoCuenta /></Guard>} />
        <Route path="inventario/stock" element={<Guard modulo="inventario"><Stock /></Guard>} />
        <Route path="inventario/kardex" element={<Guard modulo="inventario"><Kardex /></Guard>} />
        <Route path="tesoreria/cxc" element={<Guard modulo="tesoreria"><Cuentas kind="cxc" /></Guard>} />
        <Route path="tesoreria/cxp" element={<Guard modulo="tesoreria"><Cuentas kind="cxp" /></Guard>} />
        <Route path="tesoreria/caja" element={<Guard modulo="tesoreria"><Caja /></Guard>} />
        <Route path="seguridad/usuarios" element={<Guard modulo="seguridad"><Usuarios /></Guard>} />
        <Route path="seguridad/auditoria" element={<Guard modulo="auditoria"><Auditoria /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
