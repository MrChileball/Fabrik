# Fabrik - Sistema de Orquestación para Granjas de Impresoras 3D

![Status](https://img.shields.io/badge/status-Ciclo%200-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Python](https://img.shields.io/badge/python-3.11+-blue) ![Node](https://img.shields.io/badge/node-20+-green)

**Fabrik** es un sistema centralizado de orquestación para granjas de impresoras 3D con Klipper y Moonraker. Proporciona autenticación basada en roles, gestión de cuotas, asignación automática de impresoras y monitoreo en tiempo real mediante una interfaz web moderna.

## ✨ Características Principales

- ✅ **Dashboard unificado** — visualiza todos los nodos e impresoras en una sola aplicación
- ✅ **Autenticación JWT** — sistema de roles (Admin, Profesor, Estudiante, Invitado)
- ✅ **Asignación automática** — backend elige impresora ociosa según disponibilidad
- ✅ **Sistema de cuotas** — límites de filamento y horas por rol
- ✅ **Auditoría** — registro de consumo y acciones por usuario
- ✅ **Mainsail embebido** — acceso controlado vía iframe (sin URLs directas)
- ✅ **WebSocket real-time** — estado de impresoras actualizado en vivo
- ✅ **API REST completa** — documentación automática (Swagger/OpenAPI)
- ✅ **Docker Compose** — despliegue consistente dev/staging/prod
- ✅ **Raspberry Pi 4 ready** — optimizado para hardware limitado

---

## 🚀 Arranque Rápido (Desarrollo)

### 1. Requisitos Mínimos

| Componente | Versión | Requerido |
|-----------|---------|----------|
| Python | 3.10+ | ✅ Backend |
| Node.js | 18+ | ✅ Frontend |
| pnpm | 8+ | ✅ Gestor paquetes |
| Git | Cualquiera | ✅ Control versión |
| Docker | 20.10+ | ⚠️ Solo para producción |

**Instalación rápida (Linux/macOS):**
```bash
# Python (si no tienes)
curl https://www.python.org/ftp/python/3.11.0/python-3.11.0-macos11.tar.xz | tar xz

# Node.js 20
brew install node@20  # macOS
# o apt-get install nodejs npm  # Ubuntu/Debian

# pnpm (gestor de paquetes más rápido)
npm install -g pnpm
```

### 2. Clonar y Configurar

```bash
# Clonar repositorio
git clone <repo-url> fabrik
cd fabrik

# Copiar variables de entorno para desarrollo
cp .env.example .env.local

# Ver SETUP_RAPIDO.md para más detalles
cat SETUP_RAPIDO.md
```

### 3. Ejecutar Desarrollo (Sin Docker)

**Opción A: Script automático (recomendado)**
```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Esto levanta automáticamente:
- 🔵 **Backend**: http://localhost:8000 (FastAPI + Uvicorn)
- 🟢 **Frontend**: http://localhost:5173 (SvelteKit + Vite)
- 📚 **API Docs**: http://localhost:8000/docs (Swagger OpenAPI)

**Opción B: Manual (2 terminales)**

Terminal 1 - Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
python -m alembic upgrade head  # Primera vez
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 - Frontend:
```bash
pnpm install
pnpm dev
```

### 4. Verificar que todo funciona

```bash
# Backend health check
curl http://localhost:8000/health
# Esperado: {"status":"healthy","version":"0.1.0","service":"PrintRobot API"}

# Frontend accesible
curl http://localhost:5173 | head -20

# OpenAPI Swagger
curl http://localhost:8000/docs
```

---

## 📁 Estructura del Proyecto

```
fabrik/ (monorepo)
├── backend/                          # FastAPI aplicación Python
│   ├── app/
│   │   ├── main.py                  # Entry point FastAPI
│   │   ├── email_router.py          # Rutas endpoint API
│   │   ├── db/                      # Modelos SQLAlchemy + schemas
│   │   ├── services/                # Lógica negocio (auth, quotas, etc.)
│   │   └── websocket/               # WebSocket manager
│   ├── alembic/                     # Migraciones BD
│   ├── tests/                       # Tests pytest
│   ├── requirements.txt             # Deps Python
│   └── Dockerfile                   # Build prod
│
├── src/                             # SvelteKit frontend
│   ├── routes/                      # Páginas (routing file-based)
│   │   ├── +layout.svelte           # Layout principal
│   │   ├── +page.svelte             # Dashboard
│   │   ├── login/+page.svelte       # Login
│   │   └── admin/+page.svelte       # Panel admin
│   ├── lib/
│   │   ├── api.ts                   # HTTP + WS client
│   │   ├── stores.ts                # Svelte stores (estado app)
│   │   ├── types.ts                 # Interfaces TypeScript
│   │   └── components/              # Componentes reutilizables
│   └── app.css                      # Tailwind global
│
├── scripts/
│   └── dev.sh                       # 🌟 Script arranque dev
│
├── docs/
│   ├── new-plan/plan.md             # Planificación detallada
│   └── ...                          # Documentación adicional
│
├── docker-compose.yml               # Orquestación servicios
├── Dockerfile + Dockerfile.backend  # Builds multi-stage
├── nginx.conf                       # Reverse proxy config
├── requirements.txt                 # Deps backend
├── package.json                     # Deps frontend
├── .env.example                     # Template vars env
├── SETUP_RAPIDO.md                  # Quick start (5 min)
└── README.md                        # Este archivo
```

---

## 🛣️ Rutas Importantes

### Backend API

| Ruta | Método | Autenticación | Descripción |
|------|--------|---------------|-------------|
| `/health` | GET | ❌ | Health check servidor |
| `/docs` | GET | ❌ | Swagger OpenAPI docs |
| `/auth/login` | POST | ❌ | Login usuario (username + password) |
| `/auth/me` | GET | ✅ JWT | Obtener perfil actual |
| `/printers` | GET, POST | ✅ JWT | Listar impresoras |
| `/printers/{id}` | GET | ✅ JWT | Detalles 1 impresora |
| `/nodes` | GET, POST | ✅ JWT | CRUD nodos Moonraker |
| `/queue` | GET, POST | ✅ JWT | Cola de trabajos |
| `/jobs` | POST | ✅ JWT | Crear nuevo job (upload) |
| `/users/me/consumo` | GET | ✅ JWT | Mi consumo vs cuota |
| `/admin/users` | GET, POST | ✅ JWT (admin) | Gestión usuarios |
| `/admin/dashboard` | GET | ✅ JWT (admin) | Métricas generales |

**Base URL:**
- Dev: `http://localhost:8000`
- Prod (vía nginx): `http://hostname/api`

### Frontend Routes

| Ruta | Componente | Roles | Descripción |
|------|-----------|-------|-------------|
| `/` | `+page.svelte` | Todos auth | Dashboard principal |
| `/login` | `login/+page.svelte` | Público | Página login |
| `/admin` | `admin/+page.svelte` | Admin | Panel administración |
| `/printers/[printerId]` | `printers/[id]/+page.svelte` | Todos auth | Detalles impresora |

**Base URL:**
- Dev: `http://localhost:5173`
- Prod: `http://hostname` (vía nginx)

### Base de Datos (SQLite)

**Archivo:** `data/fabrik.db` (persistente)

**Tablas principales:**
```sql
users              -- username, password_hash, role_id
roles              -- admin, profesor, estudiante, invitado
nodes              -- nodos Klipper (IP, puerto, API key)
printers           -- impresoras (node_id, nombre, estado)
queue_jobs         -- cola trabajos (user_id, printer_id, estatus)
user_consumo       -- totales acumulados por usuario
audit_log          -- historial de acciones
```

Ver [docs/new-plan/plan.md](docs/new-plan/plan.md) para schema detallado.

---

## 🔧 Componentes Necesarios para Desarrollo

### Herramientas Requeridas

```bash
# Code editor (recomendado VS Code)
# - Extensions: Python, Pylance, Svelte for VS Code, Prettier, ESLint

# Backend Python
pip install -r requirements.txt
# Incluye: fastapi, uvicorn, sqlalchemy, alembic, pydantic, pytest, black, ruff

# Frontend Node
pnpm install
# Incluye: sveltekit, svelte, vite, tailwindcss, typescript, prettier, eslint

# Testing
pytest (Python)        # Backend unit tests
vitest (JavaScript)    # Frontend unit tests
playwright (JS)        # E2E tests
```

### Variables de Entorno Necesarias

Copiar `.env.example` a `.env.local` y ajustar:

```env
# Backend
DATABASE_URL=sqlite:///./data/fabrik.db       # ✅ Por defecto OK
JWT_SECRET=your-random-32-chars-key           # ⚠️ CAMBIAR en prod
MOONRAKER_TIMEOUT=10                          # Segundos

# Frontend  
VITE_API_URL=http://localhost:8000            # ✅ Por defecto OK
VITE_API_WS_URL=ws://localhost:8000/ws
```

### IDE Setup (VS Code recomendado)

**Extensions necesarias:**
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "svelte.svelte-vscode",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.makefile-tools"
  ]
}
```

**Crear `.vscode/settings.json`:**
```json
{
  "[python]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "ms-python.python"
  },
  "[javascript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

---

## 🚀 Despliegue

### Opción 1: Desarrollo Local (Recomendado Ciclo 0-1)

```bash
./scripts/dev.sh
# Levanta frontend + backend nativos en paralelo
# ✅ Reinicio automático en cambios de código
# ✅ Hot-reload completo
# ❌ No simula nginx/producción
```

### Opción 2: Docker Compose (Staging + Producción)

**Pasos:**

```bash
# 1. Preparar secrets
cp .env.production.example .env.production
nano .env.production  # Editar JWT_SECRET (random 32+ chars)

# 2. Build images
docker-compose build

# 3. Iniciar servicios
docker-compose up -d

# 4. Verificar
docker-compose ps              # Ver status
docker-compose logs -f backend # Ver logs en vivo
```

**Acceso:**
- Frontend: http://localhost:80
- API Docs: http://localhost:80/api/docs
- Backend directo: http://localhost:8000

**Parar servicios:**
```bash
docker-compose down
# O con volumen (cuidado, borra BD):
docker-compose down -v
```

### Opción 3: Raspberry Pi 4

**Requisitos especiales:**
- 2GB RAM mínimo (ajustado)
- 16GB SD card mínimo
- Docker + Docker Compose instalado

**Instalación Docker en RPi:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo apt-get install -y docker-compose
```

**Despliegue en RPi:**
```bash
# En tu máquina (preparar)
docker-compose build

# Copiar a RPi
scp -r fabrik pi@<rpi-ip>:/home/pi/

# En RPi (ejecutar)
ssh pi@<rpi-ip>
cd fabrik
docker-compose up -d

# Verificar
docker-compose ps
docker stats  # Monitor recursos
```

**Optimizar RAM (opcional):**

En `docker-compose.yml`:
```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 512M  # Limitar a 512MB
```

**Autostart en reboot:**
```bash
sudo systemctl enable docker
# Crear systemd service (ver SETUP_RAPIDO.md)
```

---

## 👥 Instrucciones para el Equipo de Instalación

### Checklist de Instalación

- [ ] **Clonar repo** con acceso Git correctamente configurado
- [ ] **Instalar requisitos:** Python 3.10+, Node.js 20+, pnpm
- [ ] **Ejecutar `./scripts/dev.sh`** y verificar ambos servicios (no debe haber errores)
- [ ] **Acceder frontend** en http://localhost:5173 (debe cargar página)
- [ ] **Acceder API Docs** en http://localhost:8000/docs (debe mostrar Swagger)
- [ ] **Copiar `.env.example` a `.env.local`** y verificar variables
- [ ] **Ejecutar `python -m alembic upgrade head`** (primera vez)
- [ ] **Verificar BD existe** con `ls backend/data/fabrik.db`

### Configuración Inicial

**1. Crear primer usuario (Admin):**
```python
# Ejecutar en terminal backend (python shell)
python -c "
from backend.app.db.models import User, Role
from backend.app.services.auth_service import hash_password
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Tu lógica aquí (o crear endpoint /admin/init)
print('TODO: Implementar seed inicial')
"
```

**2. Agregar nodos Moonraker:**
- Abrir frontend (http://localhost:5173)
- Login como admin
- Panel Admin → Agregar Nodo
- Ingresar: IP, Puerto (típico 7125), API Key

**3. Registrar impresoras:**
- Una vez agregados nodos, aparecerán automáticamente
- Editar nombre/modelo si necesario
- Verificar estado en Dashboard

### Troubleshooting Común

| Problema | Causa | Solución |
|----------|-------|---------|
| `Port 8000 already in use` | FastAPI port ocupado | `lsof -i :8000` y `kill -9 <PID>` |
| `CORS error en navegador` | Variables env incorrectas | Verificar `VITE_API_URL` en `.env.local` |
| `Database locked` | Múltiples procesos accediendo BD | Cerrar todos procesos backend |
| `Permission denied: scripts/dev.sh` | Script sin permisos | `chmod +x scripts/dev.sh` |
| `Module not found: backend` | Cwd incorrecto | `cd fabrik` (raíz proyecto) |
| Docker build timeout en RPi | Red lenta | Reintentar o descargar capas pre-build |

### Flujo de Trabajo del Equipo

**Daily:**
```bash
git pull origin develop
./scripts/dev.sh  # Levanta ambos servicios
# Hacer cambios
# Commits: feat/fix/docs/refactor (conventional commits)
```

**Code review:**
```bash
git push origin feature/tu-feature
# Crear PR en GitHub/GitLab
# Esperar revisor (24h máximo)
# Merge a develop después aprobación
```

**Testing antes de commit:**
```bash
# Backend
cd backend && pytest tests/ -v

# Frontend
pnpm test
```

---

## 📚 Documentación Adicional

| Archivo | Contenido |
|---------|----------|
| [SETUP_RAPIDO.md](SETUP_RAPIDO.md) | ⚡ Guía 5-min (primeros pasos) |
| [docs/new-plan/plan.md](docs/new-plan/plan.md) | 📋 Planificación detallada (arquitectura, ciclos, API) |
| [docs/backend-overview.md](docs/backend-overview.md) | 🔵 FastAPI arquitectura (modelos, rutas, servicios) |
| [docs/frontend-customization.md](docs/frontend-customization.md) | 🟢 SvelteKit customización (componentes, stores) |
| `docs/request-flow.md` | 🔄 Flujo solicitudes (UI → Backend → Moonraker) |

---

## 🔐 Seguridad

### Checklist Pre-Producción

- [ ] `JWT_SECRET` es string random 32+ caracteres (NO default)
- [ ] `CORS_ORIGINS` apunta a dominio real (NO localhost)
- [ ] `DATABASE_URL` usa SQLite persistente en volumen (NO en imagen)
- [ ] `.env.production` está en `.gitignore` (NO commiteado)
- [ ] HTTPS habilitado (nginx + Let's Encrypt)
- [ ] Firewall configura solo puertos necesarios (80, 443)
- [ ] Usuarios creados con contraseñas fuertes
- [ ] API `/docs` hidden en producción (agregar guard)

---

## 📊 Arquitectura en Diagrama

```
┌─────────────────────────────────────────────────────────────┐
│                     Cliente Navegador                        │
│              (http://hostname:5173 o :80)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
        ┌────────────────────────────────────────┐
        │     Nginx (Reverse Proxy)              │
        │  Puertos 80/443 (HTTP/HTTPS)           │
        └────┬──────────────────────────┬────────┘
             │                          │
      ┌──────▼──┐              ┌───────▼────┐
      │ Frontend │              │  Backend   │
      │ (Node.js)│              │ (FastAPI)  │
      │ :3000    │              │ :8000      │
      └──────┬──┘              └───────┬────┘
             │                         │
             │            ┌────────────┴──────────────┐
             │            │                           │
             └───────────►│                           │
                   HTTP   │  SQLite (data/fabrik.db) │
                          │  (Alembic migrations)    │
                          └──────────────────────────┘
                              
        ┌──────────────────────────────────────┐
        │   External (Klipper/Moonraker)       │
        │   Multiple nodes via HTTP            │
        │   (192.168.x.x:7125)                 │
        └─────────█───────────────────────────┘
                  ▲
                  │ HTTP client (httpx)
                  │
        ┌─────────┴──────────────────────┐
        │  Backend Services              │
        │ (moonraker_client.py)          │
        └────────────────────────────────┘
```

---

## To-do list

### Ciclo 0 Setup
- [ ] Clonar repo y executar `./scripts/dev.sh`
- [ ] Verificar ambos servicios corren (no errores)
- [ ] Acceder a http://localhost:5173 y http://localhost:8000/docs

- [ ] Crear modelos SQLAlchemy: `User`, `Role`
- [ ] Generar primera migración Alembic
- [ ] Crear cliente Moonraker (`services/moonraker_client.py`)
- [ ] Test: conectar a 1 impresora real

- [ ] Endpoints auth completos
- [ ] Endpoints printers/nodes
- [ ] Dashboard frontend básico
- [ ] WebSocket real-time

---

##  Soporte y Contacto

**Documentación:**
- Lee primero [SETUP_RAPIDO.md](SETUP_RAPIDO.md) (5 min)
- Luego [docs/new-plan/plan.md](docs/new-plan/plan.md) (detalle técnico)

**Troubleshooting:**
1. Revisar tabla Troubleshooting arriba
2. Ejecutar `curl http://localhost:8000/health` (healthcheck)
3. Ver logs: `docker-compose logs -f backend` (si Docker)
4. Ver consola terminal donde corre `./scripts/dev.sh`

**Issues técnicas:**
- Backend Python: revisar `backend/app/main.py`
- Frontend Svelte: revisar `src/routes/+page.svelte`
- BD: verificar `data/fabrik.db` existe

---

## 📄 Licencia

MIT License - Ver LICENSE para detalles.

---

*Última actualización: 20 de abril de 2026*
*Versión: 0.1.0 (MVP)*
