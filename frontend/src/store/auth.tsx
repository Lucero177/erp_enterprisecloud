import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { api, get, TOKEN_KEY } from '../services/api'
import { User } from '../types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  can: (modulo: string, accion?: string) => boolean
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    get<User>('/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const form = new URLSearchParams({ username, password })
    const { data } = await api.post('/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const can = useCallback(
    (modulo: string, accion = 'read') => !!user && (user.rol === 'ADMIN' || user.permisos.includes(`${modulo}:${accion}`)),
    [user],
  )

  return <Ctx.Provider value={{ user, loading, login, logout, can }}>{children}</Ctx.Provider>
}
