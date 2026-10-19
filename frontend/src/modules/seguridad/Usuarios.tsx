import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { get, post, put } from '../../services/api'
import { Badge, Button, Card, Col, DataTable, Field, Modal, PageHeader, Tabs, inputCls, useToast } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { errMsg, fdatetime } from '../../utils/format'
import { Row } from '../../types'

export default function Usuarios() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState('users')
  const [edit, setEdit] = useState<Row | null>(null)
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => get<Row[]>('/users') })
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => get<Row[]>('/users/roles') })
  const { data: permisos = [] } = useQuery({ queryKey: ['permisos'], queryFn: () => get<Row[]>('/users/permisos') })
  const [rolSel, setRolSel] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const pickRole = (id: number) => { setRolSel(id); setChecked(new Set(roles.find((r) => r.id === id)?.permisos ?? [])) }

  const save = useMutation({
    mutationFn: () => {
      const b = edit!
      if (b.id) return put(`/users/${b.id}`, { email: b.email, nombre_completo: b.nombre_completo, rol_id: Number(b.rol_id), activo: b.activo, ...(b.password ? { password: b.password } : {}) })
      return post('/users', { username: b.username, email: b.email, nombre_completo: b.nombre_completo, password: b.password, rol_id: Number(b.rol_id), activo: b.activo })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('Usuario guardado'); setEdit(null) }, onError: (e) => toast(errMsg(e), 'error'),
  })
  const savePerms = useMutation({
    mutationFn: () => put(`/users/roles/${rolSel}/permisos`, { permisos: [...checked] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast('Permisos actualizados (aplican en el próximo inicio de sesión)') }, onError: (e) => toast(errMsg(e), 'error'),
  })
  const cols: Col<Row>[] = [
    { header: 'Usuario', cell: (r) => <b>{r.username}</b> }, { header: 'Nombre', cell: (r) => r.nombre_completo }, { header: 'Email', cell: (r) => r.email },
    { header: 'Rol', cell: (r) => r.rol }, { header: 'Último acceso', cell: (r) => fdatetime(r.ultimo_login) }, { header: 'Estado', cell: (r) => <Badge value={r.activo ? 'OK' : 'ANULADO'} /> },
    { header: '', cell: (r) => can('seguridad', 'update') && <Button variant="ghost" onClick={() => setEdit({ ...r, password: '' })}><Pencil size={15} /></Button> },
  ]
  const modulos = [...new Set(permisos.map((p) => p.modulo))]
  const acciones = [...new Set(permisos.map((p) => p.accion))]
  const pid = (m: string, a: string) => permisos.find((p) => p.modulo === m && p.accion === a)?.id as number | undefined
  const rolActual = roles.find((r) => r.id === rolSel)

  return (
    <>
      <PageHeader title="Usuarios y Roles" subtitle="Gestión de usuarios, asignación de roles y permisos (RBAC)"
        actions={can('seguridad', 'create') && tab === 'users' && <Button onClick={() => setEdit({ username: '', email: '', nombre_completo: '', password: '', rol_id: roles[0]?.id ?? '', activo: true })}><Plus size={16} /> Nuevo usuario</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Usuarios' }, { id: 'roles', label: 'Roles y permisos' }]} />
      {tab === 'users' ? <DataTable columns={cols} rows={users} loading={isLoading} /> : (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Rol"><select className={inputCls + ' w-56'} value={rolSel ?? ''} onChange={(e) => e.target.value && pickRole(Number(e.target.value))}><option value="">— Seleccione —</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></Field>
            {rolActual && <span className="pb-2 text-sm text-slate-500">{rolActual.descripcion}</span>}
          </div>
          {rolActual?.nombre === 'ADMIN' && <p className="mb-3 text-sm text-amber-600">El rol ADMIN tiene acceso total y no es editable.</p>}
          {rolSel && (
            <div className="overflow-x-auto"><table className="text-sm"><thead><tr><th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Módulo</th>{acciones.map((a) => <th key={a} className="px-3 text-xs uppercase text-slate-500">{a}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{modulos.map((m) => <tr key={m}><td className="px-3 py-2 font-medium capitalize">{m}</td>{acciones.map((a) => { const id = pid(m, a); return (
                <td key={a} className="px-3 text-center">{id && <input type="checkbox" disabled={rolActual?.nombre === 'ADMIN' || !can('seguridad', 'update')} checked={checked.has(id)} onChange={(e) => { const s = new Set(checked); e.target.checked ? s.add(id) : s.delete(id); setChecked(s) }} />}</td>) })}</tr>)}</tbody></table>
              {rolActual?.nombre !== 'ADMIN' && can('seguridad', 'update') && <Button className="mt-4" loading={savePerms.isPending} onClick={() => savePerms.mutate()}>Guardar permisos</Button>}</div>
          )}
        </Card>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Editar ${edit.username}` : 'Nuevo usuario'}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Guardar</Button></>}>
        {edit && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Usuario *"><input className={inputCls} disabled={!!edit.id} value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></Field>
          <Field label="Email *"><input type="email" className={inputCls} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
          <Field label="Nombre completo *" className="sm:col-span-2"><input className={inputCls} value={edit.nombre_completo} onChange={(e) => setEdit({ ...edit, nombre_completo: e.target.value })} /></Field>
          <Field label={edit.id ? 'Nueva contraseña' : 'Contraseña *'} hint="Mínimo 8 caracteres"><input type="password" autoComplete="new-password" className={inputCls} value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
          <Field label="Rol *"><select className={inputCls} value={edit.rol_id} onChange={(e) => setEdit({ ...edit, rol_id: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} /> Activo</label></div>}
      </Modal>
    </>
  )
}
