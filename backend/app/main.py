from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.security.audit_middleware import audit_middleware

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0",
              description="ERP EnterpriseCloud · API REST (FastAPI + PostgreSQL + AWS S3)")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.middleware("http")(audit_middleware)
app.include_router(api_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["Sistema"])
def health():
    return {"status": "ok"}


# --- Full stack en un solo servicio: si existe backend/static (build de React), se sirve desde aquí
STATIC = Path(__file__).resolve().parent.parent / "static"
if (STATIC / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found")
        f = (STATIC / full_path).resolve()
        if full_path and f.is_file() and f.is_relative_to(STATIC.resolve()):
            return FileResponse(f)
        return FileResponse(STATIC / "index.html")   # rutas de React Router
