// Proxy que consolida métricas clave (temperaturas, velocidad, progreso) desde Moonraker.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_BASE_URL = 'http://192.168.1.17';

const QUERY =
  '/printer/objects/query?heater_bed=temperature,target&heater_extruder=temperature,target&extruder=temperature,target&toolhead=velocity&motion_report=live_velocity&display_status=state,message,progress&print_stats=state,message,progress,print_duration,total_duration,print_speed';

const HEADERS = {
  Accept: 'application/json'
} as const;

// Valida la URL de origen proporcionada por el cliente o aplica el valor por defecto.
function resolveBaseUrl(raw: string | null): string {
  if (!raw) {
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

export const GET: RequestHandler = async ({ fetch, url, setHeaders }) => {
  let base: string;

  try {
    base = resolveBaseUrl(url.searchParams.get('baseUrl'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid base url';
    return json({ ok: false, error: message }, { status: 400 });
  }

  const target = new URL(QUERY, base).toString();

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: HEADERS
    });

    if (!response.ok) {
      return json(
        {
          ok: false,
          error: `Moonraker responded with status ${response.status}`
        },
        { status: response.status }
      );
    }

    const payload = await response.json();
    const status = payload?.result?.status ?? {};

    const heaterBed = status.heater_bed ?? {};
    const heaterExtruder = status.extruder ?? status.heater_extruder ?? {};
    const toolhead = status.toolhead ?? {};
    const motionReport = status.motion_report ?? {};
    const displayStatus = status.display_status ?? {};
    const printStats = status.print_stats ?? {};

    const buildNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
          return null;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }

      return null;
    };

    const buildProgress = (value: unknown): number | null => {
      const num = buildNumber(value);
      if (num === null) return null;
      const normalized = num <= 1 ? num * 100 : num;
      return Math.max(0, Math.min(100, normalized));
    };

    setHeaders({
      'cache-control': 'no-store'
    });

    const motionSpeed =
      buildNumber(motionReport.live_velocity) ??
      buildNumber(printStats.print_speed) ??
      buildNumber(toolhead.velocity);

    const rawState =
      (typeof displayStatus.state === 'string' ? displayStatus.state : null) ??
      (typeof printStats.state === 'string' ? printStats.state : null) ??
      'desconocido';

    const rawMessage =
      (typeof displayStatus.message === 'string' ? displayStatus.message : null) ??
      (typeof printStats.message === 'string' ? printStats.message : null);

    const rawProgress =
      buildProgress(displayStatus.progress) ??
      buildProgress(printStats.progress);

    return json({
      ok: true,
      baseUrl: base,
      data: {
        bed: {
          temperature: buildNumber(heaterBed.temperature),
          target: buildNumber(heaterBed.target)
        },
        hotend: {
          temperature: buildNumber(heaterExtruder.temperature),
          target: buildNumber(heaterExtruder.target)
        },
        motion: {
          speed: motionSpeed
        },
        print: {
          state: String(rawState),
          message: rawMessage,
          progress: rawProgress,
          elapsedSeconds: buildNumber(printStats.print_duration),
          totalSeconds: buildNumber(printStats.total_duration)
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return json({ ok: false, error: `Moonraker request failed: ${message}` }, { status: 502 });
  }
};
