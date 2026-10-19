import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Compra, DocumentoAdjunto, Venta
from app.schemas.operations import PresignIn
from app.security.rbac import require_permission
from app.services import audit_service, storage_service as s3

router = APIRouter(prefix="/documents", tags=["Documentos (S3)"])
ENTITIES = {"compra": Compra, "venta": Venta}


def _out(d: DocumentoAdjunto) -> dict:
    return dict(id=d.id, entidad=d.entidad, entidad_id=d.entidad_id, nombre=d.nombre_original, mime_type=d.mime_type,
                tamano_bytes=d.tamano_bytes, created_at=d.created_at)


@router.post("/presign", status_code=201)
def presign(body: PresignIn, db: Session = Depends(get_db), user=Depends(require_permission("documentos", "create"))):
    """Crea el registro de metadatos en PostgreSQL y devuelve una URL prefirmada para subir el binario a S3."""
    if body.mime_type not in s3.ALLOWED_MIME:
        raise HTTPException(422, "Tipo de archivo no permitido")
    if body.tamano_bytes > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(422, f"El archivo supera el máximo de {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if not db.get(ENTITIES[body.entidad], body.entidad_id):
        raise HTTPException(404, f"No existe la {body.entidad} {body.entidad_id}")
    key = s3.build_key(body.entidad, body.entidad_id, body.nombre)
    url = s3.presign_upload(key, body.mime_type)     # si S3 falla no se crea metadato huérfano
    d = DocumentoAdjunto(entidad=body.entidad, entidad_id=body.entidad_id, nombre_original=body.nombre,
                         mime_type=body.mime_type, tamano_bytes=body.tamano_bytes, s3_bucket=settings.S3_BUCKET,
                         s3_key=key, usuario_id=user.id)
    db.add(d)
    db.flush()
    audit_service.log(db, user.id, "UPLOAD", "documentos", f"{body.entidad}:{body.entidad_id}",
                      detalle={"archivo": body.nombre, "id": d.id})
    db.commit()
    return {**_out(d), "upload_url": url, "method": "PUT", "headers": {"Content-Type": body.mime_type}}


@router.get("")
def list_docs(entidad: str, entidad_id: int, db: Session = Depends(get_db),
              user=Depends(require_permission("documentos", "read"))):
    rows = db.scalars(select(DocumentoAdjunto).where(DocumentoAdjunto.entidad == entidad,
                                                     DocumentoAdjunto.entidad_id == entidad_id)
                      .order_by(DocumentoAdjunto.created_at.desc()))
    return [_out(d) for d in rows]


@router.get("/{doc_id}/download-url")
def download_url(doc_id: str, db: Session = Depends(get_db), user=Depends(require_permission("documentos", "read"))):
    d = db.get(DocumentoAdjunto, doc_id)
    if not d:
        raise HTTPException(404, "Documento no encontrado")
    audit_service.log(db, user.id, "DOWNLOAD", "documentos", f"{d.entidad}:{d.entidad_id}", detalle={"id": d.id})
    db.commit()
    return {"url": s3.presign_download(d.s3_key, d.nombre_original)}


@router.delete("/{doc_id}")
def delete_doc(doc_id: str, db: Session = Depends(get_db), user=Depends(require_permission("documentos", "delete"))):
    d = db.get(DocumentoAdjunto, doc_id)
    if not d:
        raise HTTPException(404, "Documento no encontrado")
    try:
        s3._client().delete_object(Bucket=d.s3_bucket, Key=d.s3_key)
    except Exception:
        pass   # el objeto puede no existir si la subida nunca se completó
    audit_service.log(db, user.id, "DELETE", "documentos", f"{d.entidad}:{d.entidad_id}", detalle={"archivo": d.nombre_original})
    db.delete(d)
    db.commit()
    return {"ok": True}
