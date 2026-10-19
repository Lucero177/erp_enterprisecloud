from fastapi import APIRouter

from app.api.v1 import audit, auth, dashboard, documents, inventory, masters, purchases, sales, treasury, users

api_router = APIRouter()
for m in (auth, dashboard, masters, purchases, inventory, sales, treasury, documents, users, audit):
    api_router.include_router(m.router)
