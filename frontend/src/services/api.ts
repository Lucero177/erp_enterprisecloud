import axios from 'axios'

export const TOKEN_KEY = 'erp_token'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' })

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const get = <T = any>(url: string, params?: Record<string, unknown>) =>
  api.get<T>(url, { params: cleanParams(params) }).then((r) => r.data)
export const post = <T = any>(url: string, body?: unknown) => api.post<T>(url, body).then((r) => r.data)
export const put = <T = any>(url: string, body?: unknown) => api.put<T>(url, body).then((r) => r.data)
export const del = <T = any>(url: string) => api.delete<T>(url).then((r) => r.data)

function cleanParams(p?: Record<string, unknown>) {
  if (!p) return undefined
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false))
}
