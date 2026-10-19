from fastapi import Request

from app.services import audit_service


async def audit_middleware(request: Request, call_next):
    """Captura la IP de origen y audita 401 y errores 5xx (los éxitos/denegados se auditan en servicios/RBAC)."""
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    audit_service.request_ip.set(ip.split(",")[0].strip() if ip else None)
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/") and not path.endswith("/auth/login"):
        if response.status_code == 401 or response.status_code >= 500:
            audit_service.log_isolated(None, request.method, path.split("/")[3] if path.count("/") > 3 else "api",
                                       path, "FALLO", {"status": response.status_code})
    return response
