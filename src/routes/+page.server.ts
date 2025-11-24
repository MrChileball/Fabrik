import type { RequestEvent } from '@sveltejs/kit';
import { getSnapshot } from '$lib/server/printerStore';
import type { PrinterSnapshot } from '$lib/types/printer-registry';
import type { PageServerLoad } from './$types';

const DEFAULT_BASE_URL = 'http://192.168.1.17';

type HeaterSnapshot = {
  temperature: number | null;
  target: number | null;
};

type MotionSnapshot = {
  speed: number | null;
};

type PrintSnapshot = {
  state: string;
  message: string | null;
  progress: number | null;
  elapsedSeconds: number | null;
  totalSeconds: number | null;
};

type OverviewData = {
  bed: HeaterSnapshot;
  hotend: HeaterSnapshot;
  motion: MotionSnapshot;
  print: PrintSnapshot;
};

type PrinterState = {
  text?: string;
  message?: string;
} | null;

type PrinterMeta = {
  firmware_version?: string;
  model?: string;
} | null;

type PrinterInfo = {
  state?: PrinterState;
  printer?: PrinterMeta;
  [key: string]: unknown;
};

type OverviewResponse =
  | { ok: true; data: OverviewData; baseUrl: string }
  | { ok: false; error: string };

type StatusResponse =
  | { ok: true; data: PrinterInfo; baseUrl: string }
  | { ok: false; error: string };

const extractDeviceName = (info: PrinterInfo | null): string | null => {
  if (!info) return null;
  const printerMeta = info.printer ?? null;
  const stateMeta = info.state ?? null;
  const record = info as Record<string, unknown>;
  const printerRecord = (printerMeta ?? {}) as Record<string, unknown>;
  const candidates: unknown[] = [
    record.display_name,
    printerRecord.name,
    printerRecord.hostname,
    printerRecord.machine_name,
    printerRecord.printer_name,
    stateMeta?.text,
    record.hostname,
    printerMeta?.model
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

async function loadEndpoint<T>(
  fetchFn: RequestEvent['fetch'],
  path: string,
  params: URLSearchParams
): Promise<{ ok: true; data: T; baseUrl: string } | { ok: false; error: string }> {
  const target = `${path}?${params.toString()}`;

  try {
    const response = await fetchFn(target, {
      headers: {
        Accept: 'application/json'
      }
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; data: T; baseUrl: string }
      | { ok: false; error: string }
      | null;

    if (!response.ok) {
      if (payload && typeof payload === 'object' && 'ok' in payload) {
        return payload as { ok: true; data: T; baseUrl: string } | { ok: false; error: string };
      }

      return {
        ok: false as const,
        error: `Solicitud falló con estado ${response.status}`
      };
    }

    if (payload && typeof payload === 'object' && 'ok' in payload) {
      return payload as { ok: true; data: T; baseUrl: string } | { ok: false; error: string };
    }

    return {
      ok: false as const,
      error: 'Respuesta inesperada del servidor'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return {
      ok: false as const,
      error: `No se pudo obtener datos: ${message}`
    };
  }
}

export const load: PageServerLoad = async ({ fetch }) => {
  const params = new URLSearchParams({ baseUrl: DEFAULT_BASE_URL });

  const [overview, status] = await Promise.all([
    loadEndpoint<OverviewData>(fetch, '/api/printer-overview', params),
    loadEndpoint<PrinterInfo>(fetch, '/api/printer-info', params)
  ]);

  const inferredPrinterName = status.ok ? extractDeviceName(status.data) : null;
  const registry = await getSnapshot({
    baseUrl: DEFAULT_BASE_URL,
    printerName: inferredPrinterName ?? undefined
  });

  return {
    baseUrl: DEFAULT_BASE_URL,
    overview,
    status,
    registry
  } satisfies {
    baseUrl: string;
    overview: OverviewResponse;
    status: StatusResponse;
    registry: PrinterSnapshot;
  };
};
