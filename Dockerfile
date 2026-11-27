# Multi-stage Dockerfile for Railway / Docker single-service deployment
# Stage 1: Build Angular SPA (uses environment.prod.ts with apiBaseUrl: '/api')
FROM node:22-alpine AS frontend-builder
WORKDIR /frontend
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY Frontend/ ./
RUN npx ng build --configuration production

# Stage 2: Python Django REST API + WhiteNoise SPA host
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_DIST_DIR=/app/frontend_dist

RUN apt-get update && apt-get install -y --no-install-recommends \
    default-libmysqlclient-dev \
    gcc \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY Backend/datasee_backend /app/backend
COPY --from=frontend-builder /frontend/dist/solar-site-analyzer/browser /app/frontend_dist

WORKDIR /app/backend
RUN sed -i 's/\r$//' /app/backend/start.sh && chmod +x /app/backend/start.sh && python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["sh", "/app/backend/start.sh"]
