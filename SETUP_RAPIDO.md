# Fabrik - Setup rápido

Guía corta para levantar el proyecto en desarrollo con el enfoque actual: backend como control-plane único, subida temporal de archivos y cola por grupos de impresoras.

## 1. Requisitos

- Python 3.11+
- Node.js 20+
- pnpm
- Git

## 2. Preparar variables locales

```bash
cp .env.example .env.local
```

Revisa al menos estas variables:

- `DATABASE_URL=sqlite:///./data/fabrik.db`
- `JWT_SECRET=dev-key-change-this-in-production-min-32-chars`
- `MOONRAKER_TIMEOUT=10`
- `VITE_API_URL=http://localhost:8000`

## 3. Ejecutar desarrollo

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Esto debería levantar:

- Frontend en http://localhost:5173
- Backend en http://localhost:8000
- Health en http://localhost:8000/health

## 4. Alternativa con Docker

Si prefieres contenedores:

```bash
docker-compose up --build
```

## 5. Qué esperar hoy

- El backend todavía es mínimo.
- La documentación define el contrato objetivo.
- El backend será quien hable con Moonraker, no el frontend.
- El GCODE vivirá solo el tiempo necesario para subirlo y luego se borrará.

## 6. Troubleshooting básico

- `Permission denied: ./scripts/dev.sh` -> ejecuta `chmod +x scripts/dev.sh`.
- `Port 8000 already in use` -> libera el puerto o cambia la configuración local.
- `SQLite: database is locked` -> cierra procesos backend duplicados.
- `CORS error` -> revisa `CORS_ORIGINS` y `VITE_API_URL`.