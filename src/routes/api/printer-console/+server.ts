import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_BASE_URL = 'http://192.168.1.17';
const HEADERS = {
	Accept: 'application/json'
} satisfies Record<string, string>;
const MAX_COUNT = 500;
const DEFAULT_COUNT = 200;

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

function resolveCount(raw: string | null): number {
	if (!raw) return DEFAULT_COUNT;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed)) return DEFAULT_COUNT;
	return Math.min(Math.max(parsed, 1), MAX_COUNT);
}

export const GET: RequestHandler = async ({ fetch, url, setHeaders }) => {
	let resolvedBase: string;

	try {
		resolvedBase = resolveBaseUrl(url.searchParams.get('baseUrl'));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid base url';
		return json({ ok: false, error: message }, { status: 400 });
	}

	const count = resolveCount(url.searchParams.get('count'));
	const target = new URL(`/server/gcode_store?count=${count}`, resolvedBase).toString();

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
		const entries = Array.isArray(payload?.gcode_store)
			? payload.gcode_store
			: Array.isArray(payload?.result?.gcode_store)
				? payload.result.gcode_store
				: [];

		setHeaders({
			'cache-control': 'no-store'
		});

		return json({ ok: true, entries, baseUrl: resolvedBase });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Request failed';
		const status = message.includes('aborted') ? 504 : 502;

		return json({ ok: false, error: `Moonraker request failed: ${message}` }, { status });
	} finally {
		clearTimeout(timeout);
	}
};
