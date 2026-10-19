import re
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException

from app.core.config import settings

ALLOWED_MIME = {"application/pdf", "image/png", "image/jpeg", "application/xml", "text/xml", "text/plain",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def _client():
    return boto3.client("s3", region_name=settings.AWS_REGION, endpoint_url=settings.S3_ENDPOINT_URL or None,
                        config=Config(signature_version="s3v4"))


def build_key(entidad: str, entidad_id: int, filename: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:120]
    return f"{entidad}/{entidad_id}/{uuid.uuid4().hex}/{safe}"


def presign_upload(key: str, mime: str) -> str:
    try:
        return _client().generate_presigned_url("put_object", ExpiresIn=settings.S3_PRESIGN_EXPIRES,
                                                Params={"Bucket": settings.S3_BUCKET, "Key": key, "ContentType": mime})
    except (BotoCoreError, ClientError) as e:
        raise HTTPException(503, f"S3 no disponible o sin credenciales: {e}")


def presign_download(key: str, filename: str) -> str:
    try:
        return _client().generate_presigned_url(
            "get_object", ExpiresIn=settings.S3_PRESIGN_EXPIRES,
            Params={"Bucket": settings.S3_BUCKET, "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{filename}"'})
    except (BotoCoreError, ClientError) as e:
        raise HTTPException(503, f"S3 no disponible o sin credenciales: {e}")
