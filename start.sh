@echo off
cd /d "%~dp0backend"
set PY=python
py -3.12 --version >nul 2>&1 && set PY=py -3.12
if not exist .venv ( %PY% -m venv .venv )
call .venv\Scripts\activate.bat
python -m pip install -q --upgrade pip
python -m pip install -q -r requirements.txt
if errorlevel 1 ( echo. & echo ERROR instalando librerias. Lea el mensaje de arriba. & pause & exit /b 1 )
if "%DATABASE_URL%"=="" set DATABASE_URL=sqlite:///./erp.db
python -m scripts.seed
if errorlevel 1 ( echo ERROR creando la base de datos. & pause & exit /b 1 )
echo.
echo ERP EnterpriseCloud en http://localhost:8000  (usuario: admin / Admin123!)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000