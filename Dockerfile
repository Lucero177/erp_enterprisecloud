# Imagen única full stack: compila React y lo sirve desde FastAPI
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /web/dist ./static
EXPOSE 8000
CMD ["sh", "-c", "python -m scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2"]
