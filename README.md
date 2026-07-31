# Fabrik

Fabrik es un sistema de orquestación para granjas de impresoras 3D con Klipper y Moonraker.
La documentación de este repositorio define un MVP simple: control-plane central en FastAPI, interfaz en SvelteKit, cola por grupos de impresoras similares y persistencia ligera con SQLite.

## Enfoque actual

- El backend será el único orquestador frente a Moonraker.
- El frontend no decidirá negocio; solo consumirá el backend.
- Los archivos GCODE se subirán de forma temporal al backend, se reenviarán a Moonraker y se borrarán cuando el nodo confirme recepción.
- La cola se organiza por grupos de impresoras con specs compatibles.
- La prioridad es: grupo compatible primero, luego antigüedad del job dentro del grupo.
- SQLite es suficiente para el MVP si la instancia backend es única y la concurrencia es baja.
- El historial mínimo a conservar es: nodo, impresora, tiempos, filamento, estado del trabajo y auditoría.
- El estado actual del job y su historial de eventos se separan desde el diseño.
- Cada impresora se identifica por su endpoint real de Moonraker.

## Qué cubre el MVP

- Inventario de nodos Moonraker y sus impresoras.
- Registro de grupos de impresoras por specs.
- Cola de trabajos con estado y asignación.
- Registro de consumo por trabajo.
- Auditoría básica de acciones relevantes.
- Monitoreo de estado desde Moonraker.

## Documentación relacionada

- [Arquitectura y flujos](docs/architecture.md)
- [Estructura del backend](docs/backend-structure.md)
- [Esquema de datos](backend/SCHEMA.md)
- [Setup rápido](SETUP_RAPIDO.md)

## Estructura del repositorio

```text
backend/   FastAPI y lógica de orquestación
src/       Frontend SvelteKit
scripts/   Utilidades de desarrollo
docs/      Arquitectura y procesos
```

## Arranque rápido

1. Copia la configuración local:

```bash
cp .env.example .env.local
```

2. Levanta el entorno de desarrollo:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

3. Verifica los servicios:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Health: http://localhost:8000/health

## Variables clave

- `DATABASE_URL`: SQLite local para el MVP.
- `JWT_SECRET`: clave secreta para autenticación cuando se implemente.
- `MOONRAKER_TIMEOUT`: tiempo máximo de espera hacia Moonraker.
- `VITE_API_URL`: URL pública del backend para el frontend.

## Estado actual

El código aún está en una base mínima. Hoy el backend expone health y root, y el frontend funciona como vista de arranque.
La documentación de esta carpeta es la fuente de verdad para el diseño objetivo hasta que el backend y el frontend alcancen ese contrato.

## Siguiente paso recomendado

Cuando se empiece a codificar, el orden correcto es:
1. Crear el modelo de datos mínimo.
2. Implementar el cliente Moonraker.
3. Definir el scheduler por grupos.
4. Integrar upload temporal y borrado posterior.