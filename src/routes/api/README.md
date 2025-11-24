# API Proxies

La carpeta `src/routes/api` expone *endpoints* del propio SvelteKit que actúan como capa intermedia entre el cliente y Moonraker. SvelteKit trata cualquier `+server.ts` bajo `src/routes` como una ruta HTTP tradicional, así que mantener estos archivos en `routes/api` evita filtrar directamente la IP del servidor de impresión al navegador y permite añadir validaciones, logging y saneamiento.

Actualmente se publican tres proxys:

- `/api/printer-info`: recupera `printer/info` para obtener metadatos del dispositivo (nombre, firmware, etc.).
- `/api/printer-overview`: agrega lecturas de temperatura, velocidad y progreso consultando varios objetos de Moonraker.
- `/api/printer-control`: acepta acciones de control (pausa, homing, macros, setpoints) y las traduce a comandos Moonraker con logging.

Todos los proxys admiten un parámetro opcional `baseUrl` para apuntar a otra instancia de Moonraker. Si no se envía, utilizan `http://192.168.1.17`. La carpeta también es un buen lugar para añadir futuros endpoints internos (por ejemplo, históricos o agregados) sin mezclar lógica con los componentes Svelte.
