import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getSnapshot,
	registerPrinter,
	removeNode,
	removePrinter,
	upsertPrinterStates
} from '$lib/server/printerStore';
import type { StoredPrinterState } from '$lib/types/printer-registry';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const baseUrl = url.searchParams.get('baseUrl') ?? undefined;
	const printerName = url.searchParams.get('printerName') ?? undefined;
	const snapshot = await getSnapshot({ baseUrl, printerName });

	setHeaders({
		'cache-control': 'no-store'
	});

	return json({ ok: true, snapshot });
};

type RegistryAction =
	| {
			action: 'add-printer';
			name?: unknown;
			baseUrl?: unknown;
			nodeId?: unknown;
			nodeName?: unknown;
		}
	| {
			action: 'remove-printer';
			printerId?: unknown;
		}
	| {
			action: 'remove-node';
			nodeId?: unknown;
		}
	| {
			action: 'sync-states';
			states?: unknown;
		};

const parseStates = (value: unknown): Record<string, StoredPrinterState> => {
	if (!value || typeof value !== 'object') {
		return {};
	}
	const entries = Object.entries(value as Record<string, unknown>);
	const filtered: [string, StoredPrinterState][] = [];
	for (const [printerId, summary] of entries) {
		if (typeof printerId !== 'string') continue;
		if (!summary || typeof summary !== 'object') continue;
		const state = summary as StoredPrinterState;
		filtered.push([printerId, state]);
	}
	return Object.fromEntries(filtered);
};

export const POST: RequestHandler = async ({ request, setHeaders }) => {
	let payload: RegistryAction;

	try {
		payload = (await request.json()) as RegistryAction;
	} catch (error) {
		return json({ ok: false, error: 'Cuerpo inválido, se esperaba JSON.' }, { status: 400 });
	}

	if (!payload || typeof payload !== 'object' || typeof payload.action !== 'string') {
		return json({ ok: false, error: 'Acción no especificada.' }, { status: 400 });
	}

	try {
		let snapshot;
		switch (payload.action) {
			case 'add-printer': {
				const name = typeof payload.name === 'string' ? payload.name : '';
				const baseUrl = typeof payload.baseUrl === 'string' ? payload.baseUrl : '';
				const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId : undefined;
				const nodeName = typeof payload.nodeName === 'string' ? payload.nodeName : undefined;
				snapshot = await registerPrinter({ name, baseUrl, nodeId, nodeName });
				break;
			}
			case 'remove-printer': {
				const printerId = typeof payload.printerId === 'string' ? payload.printerId : '';
				snapshot = await removePrinter(printerId);
				break;
			}
			case 'remove-node': {
				const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId : '';
				snapshot = await removeNode(nodeId);
				break;
			}
			case 'sync-states': {
				const states = parseStates(payload.states);
				snapshot = await upsertPrinterStates(states);
				break;
			}
			default:
				return json({ ok: false, error: 'Acción no soportada.' }, { status: 400 });
		}

		setHeaders({
			'cache-control': 'no-store'
		});

		return json({ ok: true, snapshot });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Acción no completada.';
		return json({ ok: false, error: message }, { status: 400 });
	}
};
