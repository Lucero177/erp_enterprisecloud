import { useRef, useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Paperclip, Trash2, Upload } from 'lucide-react'
import { del, get, post } from '../../services/api'
import { Button, useToast } from '../../components/ui'
import { useAuth } from '../../store/auth'
import { errMsg, fdatetime } from '../../utils/format'
import { Row } from '../../types'

/** Adjuntos de una compra/venta: metadatos en PostgreSQL, binario en S3 vía URL prefirmada (PUT directo desde el navegador). */
export default function Adjuntos({ entidad, entidadId }: { entidad: 'compra' | 'venta'; entidadId: number }) {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const key = ['docs', entidad, entidadId]
  const { data: docs = [] } = useQuery({ queryKey: key, queryFn: () => get<Row[]>('/documents', { entidad, entidad_id: entidadId }), enabled: can('documentos', 'read') })

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const p = await post('/documents/presign', { entidad, entidad_id: entidadId, nombre: file.name, mime_type: file.type || 'application/octet-stream', tamano_bytes: file.size })
      await axios.put(p.upload_url, file, { headers: p.headers })   // sin token de la API: va directo a S3
      qc.invalidateQueries({ queryKey: key })
      toast('Archivo subido a S3')
    } catch (e) { toast(errMsg(e), 'error') } finally { setUploading(false); if (input.current) input.current.value = '' }
  }
  const download = async (id: string) => { try { const r = await get(`/documents/${id}/download-url`); window.open(r.url, '_blank') } catch (e) { toast(errMsg(e), 'error') } }
  const remove = useMutation({ mutationFn: (id: string) => del(`/documents/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: key }), onError: (e) => toast(errMsg(e), 'error') })

  if (!can('documentos', 'read')) return null
  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Paperclip size={15} /> Documentos adjuntos</h4>
        {can('documentos', 'create') && (
          <>
            <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="secondary" loading={uploading} onClick={() => input.current?.click()}><Upload size={14} /> Subir archivo</Button>
          </>
        )}
      </div>
      {docs.length === 0 ? <p className="text-xs text-slate-400">Sin adjuntos (PDF, imágenes, XML, Excel o Word · máx. 20 MB)</p> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-1.5">
              <div><div className="font-medium">{d.nombre}</div><div className="text-xs text-slate-400">{(d.tamano_bytes / 1024).toFixed(0)} KB · {fdatetime(d.created_at)}</div></div>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => download(d.id)}><Download size={15} /></Button>
                {can('documentos', 'delete') && <Button variant="ghost" onClick={() => confirm('¿Eliminar adjunto?') && remove.mutate(d.id)}><Trash2 size={15} className="text-red-500" /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
