import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_BASE_URL = 'http://192.168.1.17';

const HEADERS = {
  Accept: 'application/json'
} as const;

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

const normalizeMacroName = (raw: string): string => {
  if (!raw) return raw;
  const prefix = 'gcode_macro ';
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
};

export const GET: RequestHandler = async ({ fetch, url, setHeaders }) => {
  let base: string;

  try {
    base = resolveBaseUrl(url.searchParams.get('baseUrl'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid base url';
    return json({ ok: false, error: message }, { status: 400 });
  }

  const target = new URL('/printer/objects/list', base).toString();

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

    const payload = await response.json().catch(() => null);
    const objects = (payload?.result?.objects ?? payload?.result ?? []) as unknown[];
    const macros = objects
      .flatMap((entry) => {
        if (typeof entry === 'string') {
          return entry.startsWith('gcode_macro ') ? [normalizeMacroName(entry)] : [];
        }

        if (entry && typeof entry === 'object' && 'name' in entry) {
          const name = (entry as { name: unknown }).name;
          return typeof name === 'string' && name.startsWith('gcode_macro ') ? [normalizeMacroName(name)] : [];
        }

        return [];
      })
      .filter((name, index, array) => array.findIndex((other) => other === name) === index)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    setHeaders({ 'cache-control': 'no-store' });

    return json({
      ok: true,
      baseUrl: base,
      macros: macros.map((name) => ({ name }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return json({ ok: false, error: `Moonraker request failed: ${message}` }, { status: 502 });
  }
};
