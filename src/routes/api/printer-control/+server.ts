// Endpoint SvelteKit que proxea comandos de control hacia Moonraker, añadiendo validaciones y logging.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_BASE_URL = 'http://192.168.1.17';

const HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
} as const;

// Acciones predefinidas que no requieren parámetros adicionales.
const STATIC_ACTIONS = {
  pause: {
    method: 'POST',
    path: '/printer/print/pause'
  },
  home_xy: {
    method: 'POST',
    path: '/printer/gcode/script',
    body: { script: 'G28 X Y' }
  },
  home_xyz: {
    method: 'POST',
    path: '/printer/gcode/script',
    body: { script: 'G28' }
  },
  bed_mesh_calibrate: {
    method: 'POST',
    path: '/printer/gcode/script',
    body: { script: 'BED_MESH_CALIBRATE' }
  },
  screws_tilt_calculate: {
    method: 'POST',
    path: '/printer/gcode/script',
    body: { script: 'SCREWS_TILT_CALCULATE' }
  }
} satisfies Record<string, { method: 'POST'; path: string; body?: Record<string, unknown> }>;

function resolveBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return DEFAULT_BASE_URL;
  }

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Protocolo no soportado');
    }
    return parsed.origin;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'URL inválida';
    throw new Error(`Invalid baseUrl provided: ${message}`);
  }
}

type ActionConfig = { method: 'POST'; path: string; body?: Record<string, unknown> };

// Normaliza la acción solicitada en una instrucción Moonraker concreta.
function buildActionConfig(action: string, value: unknown): ActionConfig | { error: string } {
  if (action === 'gcode_script') {
    if (typeof value !== 'string' || value.trim() === '') {
      return { error: 'Comando GCode inválido' };
    }

    return {
      method: 'POST',
      path: '/printer/gcode/script',
      body: { script: value.trim() }
    };
  }

  if (action === 'set_bed_temperature' || action === 'set_hotend_temperature') {
    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) {
      return { error: 'Valor de temperatura inválido' };
    }

    const heater = action === 'set_bed_temperature' ? 'heater_bed' : 'extruder';
    const script = `SET_HEATER_TEMPERATURE HEATER=${heater} TARGET=${numeric}`;

    return {
      method: 'POST',
      path: '/printer/gcode/script',
      body: { script }
    };
  }

  if (!(action in STATIC_ACTIONS)) {
    return { error: 'Acción no soportada' };
  }

  return STATIC_ACTIONS[action as keyof typeof STATIC_ACTIONS];
}

export const POST: RequestHandler = async ({ request, fetch, setHeaders }) => {
  let payload: { action?: string; baseUrl?: string | null; value?: unknown };

  try {
    payload = (await request.json()) as { action?: string; baseUrl?: string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid body';
    return json({ ok: false, error: `No se pudo parsear la solicitud: ${message}` }, { status: 400 });
  }

  const { action, baseUrl, value } = payload ?? {};

  if (!action) {
    return json({ ok: false, error: 'Acción no soportada' }, { status: 400 });
  }

  let base: string;

  try {
    base = resolveBaseUrl(baseUrl ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid base url';
    return json({ ok: false, error: message }, { status: 400 });
  }

  const config = buildActionConfig(action, value);

  if ('error' in config) {
    return json({ ok: false, error: config.error }, { status: 400 });
  }

  const actionConfig = config;
  const target = new URL(actionConfig.path, base).toString();
  const body = 'body' in actionConfig ? JSON.stringify(actionConfig.body) : undefined;

  try {
    console.info('[printer-control] Sending command', {
      action,
      target,
      body: body ? JSON.parse(body) : undefined
    });

    const response = await fetch(target, {
      method: actionConfig.method,
      headers: HEADERS,
      body
    });

    if (!response.ok) {
      const message = `Moonraker respondió con estado ${response.status}`;
      console.warn('[printer-control] Moonraker returned error status', {
        action,
        status: response.status,
        path: target
      });
      return json({ ok: false, error: message }, { status: response.status });
    }

    const text = await response.text();
    let moonrakerPayload: unknown = null;

    if (text) {
      try {
        moonrakerPayload = JSON.parse(text);
      } catch {
        moonrakerPayload = text;
      }
    }

    console.info('[printer-control] Moonraker acknowledged command', {
      action,
      status: response.status,
      payload: moonrakerPayload
    });

    setHeaders({ 'cache-control': 'no-store' });

    return json({
      ok: true,
      message: 'Comando enviado correctamente',
      status: response.status,
      moonraker: moonrakerPayload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moonraker request failed';
    console.error('[printer-control] Failed to send command', {
      action,
      target,
      error: message
    });
    return json({ ok: false, error: `Fallo al contactar Moonraker: ${message}` }, { status: 502 });
  }
};
