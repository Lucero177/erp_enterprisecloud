import os
import tempfile

_tmp = os.path.join(tempfile.gettempdir(), "erp_test.db")
if os.path.exists(_tmp):
    os.remove(_tmp)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}"
os.environ["AWS_ACCESS_KEY_ID"] = "test"
os.environ["AWS_SECRET_ACCESS_KEY"] = "test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from scripts.seed import seed  # noqa: E402


@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(engine)
    with SessionLocal() as s:
        seed(s)
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin(client):
    r = client.post("/api/v1/auth/login", data={"username": "admin", "password": "Admin123!"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
