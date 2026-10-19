import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Field, inputCls } from '../components/ui'
import { useAuth } from '../store/auth'
import { errMsg } from '../utils/format'

export default function Login() {
  const { user, login } = useAuth()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(u, p) } catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">E</div>
          <h1 className="text-xl font-semibold">ERP EnterpriseCloud</h1><p className="text-sm text-slate-500">Inicie sesión para continuar</p></div>
        <Field label="Usuario"><input className={inputCls} autoFocus value={u} onChange={(e) => setU(e.target.value)} /></Field>
        <Field label="Contraseña"><input type="password" className={inputCls} value={p} onChange={(e) => setP(e.target.value)} /></Field>
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={!u || !p}>Ingresar</Button>
      </form>
    </div>
  )
}
