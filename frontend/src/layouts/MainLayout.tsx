import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../store/auth'

export default function MainLayout() {
  const { user, logout } = useAuth()
  const [mobile, setMobile] = useState(false)
  const aside = (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">E</div>
        <div><div className="text-sm font-semibold text-white">ERP EnterpriseCloud</div><div className="text-[11px] text-slate-400">Gestión empresarial</div></div>
      </div>
      <Sidebar onNavigate={() => setMobile(false)} />
      <div className="border-t border-slate-800 p-3">
        <div className="px-2 pb-2"><div className="truncate text-sm font-medium text-white">{user?.nombre_completo}</div><div className="text-xs text-slate-400">{user?.rol}</div></div>
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-slate-800"><LogOut size={16} /> Cerrar sesión</button>
      </div>
    </aside>
  )
  return (
    <div className="flex h-screen">
      <div className="hidden lg:block">{aside}</div>
      {mobile && (
        <div className="fixed inset-0 z-40 flex lg:hidden"><div>{aside}</div><div className="flex-1 bg-black/50" onClick={() => setMobile(false)} /></div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setMobile(true)}><Menu /></button><span className="font-semibold">ERP EnterpriseCloud</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
