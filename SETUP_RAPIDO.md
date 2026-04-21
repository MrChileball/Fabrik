# 🚀 PrintRobot - Setup Rápido 

## ¿Qué se ha preparado?

✅ Estructura monorepo (backend FastAPI + frontend SvelteKit)  
✅ Docker Compose para producción  
✅ Script de desarrollo paralelo (sin Docker)  
✅ SQLite como BD (simple, rápido)  
✅ Archivos de configuración template  

---

## 🎯 Start Rápido (Desarrollo Nativo - 5 min)

### 1. Configurar variables de entorno
```bash
cp .env.example .env.local
# Editar .env.local si necesario (normalmente OK por defecto)
```

### 2. Hacer script ejecutable
```bash
chmod +x scripts/dev.sh
```

### 3. Ejecutar desarrollo
```bash
./scripts/dev.sh
```

**Listo!** Accede a:
- **Frontend:** http://localhost:5173
- **Backend Docs:** http://localhost:8000/docs

---

## 🐳 Producción con Docker (RPi4 u otro)

### 1. Build images
```bash
docker-compose build
```

### 2. Crear .env.production (MUY IMPORTANTE)
```bash
cp .env.production.example .env.production
# Editar: cambiar JWT_SECRET a algo random + URLs de prod
nano .env.production
```

### 3. Iniciar servicios
```bash
docker-compose up -d
docker-compose logs -f backend  # Ver logs
```

**Acceso:**
- http://localhost (todo reversado vía nginx)
- http://localhost/api/docs (API Swagger)

---

## 📁 Estructura Creada

```
fabrik/
├── backend/                    # FastAPI app (nuevo)
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py            # Entry point FastAPI
│   ├── alembic/               # DB migrations
│   └── venv/                  # Python venv (después de run)
├── src/                        # SvelteKit frontend (existente)
├── scripts/
│   └── dev.sh                 # Script paralelo dev
├── docker-compose.yml         # Orquestar servicios
├── Dockerfile                 # Build SvelteKit
├── Dockerfile.backend         # Build FastAPI
├── nginx.conf                 # Reverse proxy
├── .env.example               # Template vars
├── .env.production.example    # Production reference
├── requirements.txt           # Python deps
└── .dockerignore              # Docker excludes
```

---

## ⚙️ Próximos Pasos (Ciclo 0)

### Hoy
- [ ] Correr `./scripts/dev.sh` y verificar que ambos servicios levanten
- [ ] Acceder a http://localhost:5173 (debe cargar frontend)
- [ ] Acceder a http://localhost:8000/docs (Swagger debe estar up)

### Mañana (Backend PoC)
- [ ] Crear primeros modelos SQLAlchemy: `User`, `Role` (en `backend/app/models.py`)
- [ ] Generar primer migrations: `cd backend && alembic revision --autogenerate -m "initial schema"`
- [ ] Conectar a Moonraker: crear `backend/app/services/moonraker_client.py`
- [ ] Test: leer estado de 1 impresora real desde backend

### Testing Docker en RPi4
- [ ] Copiar repo a RPi4
- [ ] Editar `.env.production`
- [ ] Correr `docker-compose build && docker-compose up -d`
- [ ] Verificar servicios: `docker-compose ps`

---

## 🛠️ Troubleshooting

| Problema | Solución |
|----------|----------|
| `Permission denied: ./scripts/dev.sh` | `chmod +x scripts/dev.sh` |
| `ModuleNotFoundError: No module named 'backend'` | Backend debe correr desde raíz (`cd fabrik`) |
| `Port 8000 already in use` | `lsof -i :8000` | `kill -9 <PID>` |
| `Port 5173 already in use` | `lsof -i :5173` | `kill -9 <PID>` |
| `SQLite: database is locked` | Cerrar todos procesos backend |
| Docker build download fails en RPi | Problema de red; reintentar o usar `docker pull` |

---

## 📚 Documentación Completa

Ver [docs/new-plan/plan.md](docs/new-plan/plan.md) para:
- Arquitectura detallada
- Especificación de API endpoints
- Modelos de BD (SQLite)
- Git workflow + convenciones
- Timeline de ciclos (Ciclo 0-4)

---

**¡Proyecto listo para Ciclo 0!** 🎉
