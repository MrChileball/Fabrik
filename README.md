# Moonraker Dashboard (SvelteKit)

Dashboard web construido con SvelteKit y Tailwind para supervisar y controlar impresoras 3D mediante comunicación con por la API de moonraker a hosts de Klipper. El objetivo es centralizar estado, comandos rápidos y diagnósticos en una sola interfaz reutilizable.

## Características principales
- Consulta periódica del `PrinterOverview` y `PrinterStatus` mediante proxys locales (`/api/printer-*`).
- Controles rápidos para temperatura, homing, pausa/reanudación y macros predefinidas a través de `/api/printer-control`.
- Persistencia local en disco (JSON) para registrar nodos, impresoras y resúmenes de estado accesibles desde cualquier cliente.
- Kit de componentes UI compartidos (`Button`, `Toggle`, `MetricTile`, `ProgressBar`, etc.) listo para tematización oscura.
- Creación de listas y nodos de impresoras ordenada para el fácil acceso a ajustes.
- Creación de perfiles de comandos personalizados para automatizar procesos.

## Requisitos
- Node.js 20 o superior.
- pnpm 8.
- Acceso a un servidor Moonraker alcanzable desde la máquina que ejecuta el dashboard.

## Puesta en marcha
```sh
pnpm install
pnpm dev
```

Puedes usar la tarea de VS Code `pnpm dev` ya configurada. El servidor de desarrollo escucha en `http://localhost:5173`.

## Compilación y pruebas
- `pnpm check`: analiza tipos y componentes Svelte.
- `pnpm test`: ejecuta pruebas (añade suites según tus necesidades).
- `pnpm build`: genera el artefacto listo para producción en `build/`.
- `pnpm preview`: sirve la build usando el adaptador Node para validación local.

## Despliegue
1. Ejecuta `pnpm build` en el entorno objetivo.
2. Publica el contenido de `build/` en un servidor Node o un contenedor que mantenga el adaptador seleccionado.
3. Configura la variable de entorno `MOONRAKER_BASE_URL` o ajusta el registro persistente (`data/printer-store.json`) para apuntar a tus impresoras.
4. Asegura que el puerto expuesto por el adaptador coincida con el configurado en tu plataforma (por defecto 4173 para `pnpm preview`).

## Persistencia y datos
El backend mantiene el inventario en `data/printer-store.json`. El módulo `src/lib/server/printerStore.ts` gestiona la caché en memoria, la validación y la escritura en disco.

## Documentación adicional
Consulta la carpeta `docs/` para guías específicas:
- `docs/backend-overview.md`: arquitectura y ciclo de vida del backend.
- `docs/request-flow.md`: recorrido de las solicitudes desde la UI hasta Moonraker.
- `docs/page-server.md`: responsabilidades de `+page.server.ts` y estrategias de carga.
- `docs/frontend-customization.md`: cómo extender widgets y componentes UI.

El dashboard asume que Moonraker expone su API en `http://192.168.1.17`. Puedes registrar nuevos nodos e impresoras mediante la interfaz o editando el archivo de datos (ver guías en `docs/`).
