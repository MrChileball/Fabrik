// Proxy directo a /printer/info de Moonraker, usado para obtener metadatos del dispositivo desde el SSR.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_BASE_URL = 'http://192.168.1.17';

const HEADERS = {
  Accept: 'application/json'
} satisfies Record<string, string>;

// Permite que el cliente pase un baseUrl personalizado, validando protocolo y origen.
function resolveBaseUrl(raw: string | null): string {
  if (!raw) {
    return DEFAULT_BASE_URL;
  }

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Unsupported protocol');
    }

    return parsed.origin;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL';
    throw new Error(`Invalid baseUrl provided: ${message}`);
  }
}

export const GET: RequestHandler = async ({ fetch, url, setHeaders }) => {
  let resolvedBase: string;

  try {
    resolvedBase = resolveBaseUrl(url.searchParams.get('baseUrl'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid base url';
    return json({ ok: false, error: message }, { status: 400 });
  }

  const target = new URL('/printer/info', resolvedBase).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: HEADERS,
      signal: controller.signal
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

    setHeaders({
      'cache-control': 'no-store'
    });

    return json({
      ok: true,
      data: payload?.result ?? payload,
      baseUrl: resolvedBase
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    const status = message.includes('aborted') ? 504 : 502;

    return json({ ok: false, error: `Moonraker request failed: ${message}` }, { status });
  } finally {
    clearTimeout(timeout);
  }
};
