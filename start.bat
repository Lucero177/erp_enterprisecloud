@echo off
cd /d "%~dp0backend"
if "%DATABASE_URL%"=="" set DATABASE_URL=sqlite:///./erp.db
pip install -q -r requirements.txt
python -m scripts.seed
echo ERP EnterpriseCloud en http://localhost:8000  (usuario: admin / Admin123!)
uvicorn app.main:app --host 0.0.0.0 --port 8000
