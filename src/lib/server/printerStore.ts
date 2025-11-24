import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
	PrinterConfig,
	PrinterNode,
	PrinterSnapshot,
	StoredPrinterState
} from '$lib/types/printer-registry';

const DATA_DIRECTORY = path.resolve(process.cwd(), 'data');
const STORE_FILENAME = 'printer-store.json';
const STORE_PATH = path.join(DATA_DIRECTORY, STORE_FILENAME);
const CACHE_TTL_MS = 5_000;

type SnapshotCache = {
	snapshot: PrinterSnapshot;
	expiresAt: number;
};

let cache: SnapshotCache | null = null;

const now = () => Date.now();

const createId = () => {
	try {
		return randomUUID();
	} catch (error) {
		const message = error instanceof Error ? error.message : `${error ?? ''}`;
		console.warn('[PrinterStore] randomUUID no disponible, usando alternativa', message);
		return `id-${Math.random().toString(36).slice(2, 11)}-${now().toString(36)}`;
	}
};

const ensureDataDirectory = async () => {
	await fs.mkdir(DATA_DIRECTORY, { recursive: true });
};

const isValidNode = (entry: unknown): entry is PrinterNode => {
	if (!entry || typeof entry !== 'object') return false;
	const node = entry as Record<string, unknown>;
	return (
		typeof node.id === 'string' &&
		node.id.length > 0 &&
		typeof node.name === 'string' &&
		node.name.length > 0 &&
		typeof node.createdAt === 'number'
	);
};

const isValidPrinter = (entry: unknown, nodeIds: Set<string>): entry is PrinterConfig => {
	if (!entry || typeof entry !== 'object') return false;
	const printer = entry as Record<string, unknown>;
	return (
		typeof printer.id === 'string' &&
		printer.id.length > 0 &&
		typeof printer.name === 'string' &&
		printer.name.length > 0 &&
		typeof printer.baseUrl === 'string' &&
		printer.baseUrl.length > 0 &&
		typeof printer.nodeId === 'string' &&
		nodeIds.has(printer.nodeId) &&
		typeof printer.createdAt === 'number'
	);
};

const isValidState = (entry: unknown): entry is StoredPrinterState => {
	if (!entry || typeof entry !== 'object') return false;
	const state = entry as Record<string, unknown>;
	const isValidLabel = typeof state.label === 'string' && state.label.length > 0;
	const isValidVariant = typeof state.variant === 'string';
	const isValidProgress = state.progress === null || typeof state.progress === 'number';
	const isValidError = state.error === null || typeof state.error === 'string';
	const isValidUpdatedAt = state.updatedAt === null || typeof state.updatedAt === 'number';
	const isValidMessage = state.message === null || typeof state.message === 'string';
	return isValidLabel && isValidVariant && isValidProgress && isValidError && isValidUpdatedAt && isValidMessage;
};

const sanitizeSnapshot = (snapshot: Partial<PrinterSnapshot> | null | undefined): PrinterSnapshot => {
	const nodesSource = Array.isArray(snapshot?.nodes) ? snapshot?.nodes : [];
	const nodes: PrinterNode[] = nodesSource.filter(isValidNode);

	const nodeIds = new Set(nodes.map((node) => node.id));
	const printersSource = Array.isArray(snapshot?.printers) ? snapshot?.printers : [];
	const printers: PrinterConfig[] = printersSource.filter((entry) => isValidPrinter(entry, nodeIds));

	const statesSource = snapshot?.states && typeof snapshot.states === 'object' ? snapshot.states : undefined;
	const statesEntries = statesSource ? Object.entries(statesSource) : [];
	const printerIds = new Set(printers.map((printer) => printer.id));
	const validStates = statesEntries.filter(([printerId, state]) => printerIds.has(printerId) && isValidState(state));
	const states = validStates.length > 0 ? Object.fromEntries(validStates) : undefined;

	return {
		nodes,
		printers,
		states,
		updatedAt: typeof snapshot?.updatedAt === 'number' ? snapshot.updatedAt : now()
	};
};

const readSnapshotFromDisk = async (): Promise<PrinterSnapshot> => {
	try {
		const raw = await fs.readFile(STORE_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<PrinterSnapshot>;
		return sanitizeSnapshot(parsed);
	} catch (error) {
		const asErr = error as { code?: unknown } | null | undefined;
		if (asErr && typeof asErr.code === 'string' && asErr.code === 'ENOENT') {
			return {
				nodes: [],
				printers: [],
				states: undefined,
				updatedAt: now()
			};
		}
		console.warn('[PrinterStore] No se pudo leer el archivo, se usará snapshot vacío', error);
		return {
			nodes: [],
			printers: [],
			states: undefined,
			updatedAt: now()
		};
	}
};

const writeSnapshotToDisk = async (snapshot: PrinterSnapshot) => {
	await ensureDataDirectory();
	const payload = JSON.stringify(snapshot, null, 2);
	await fs.writeFile(STORE_PATH, payload, 'utf-8');
	cache = {
		snapshot,
		expiresAt: now() + CACHE_TTL_MS
	};
};

const updateSnapshot = async (
	mutator: (current: PrinterSnapshot) => PrinterSnapshot
): Promise<PrinterSnapshot> => {
	const current = await readSnapshotFromDisk();
	const next = sanitizeSnapshot(mutator(current));
	next.updatedAt = now();
	await writeSnapshotToDisk(next);
	return next;
};

const maybeSeedDefaults = async (
	snapshot: PrinterSnapshot,
	defaults?: { baseUrl?: string; printerName?: string }
): Promise<PrinterSnapshot> => {
	if (snapshot.nodes.length > 0 && snapshot.printers.length > 0) {
		return snapshot;
	}

	const baseUrl = defaults?.baseUrl;
	const printerName = (defaults?.printerName ?? '').trim() || 'Impresora principal';
	const nowTs = now();

	if (!baseUrl) {
		return snapshot;
	}

	const principalNode: PrinterNode = {
		id: createId(),
		name: 'Nodo principal',
		createdAt: nowTs
	};

	const principalPrinter: PrinterConfig = {
		id: createId(),
		name: printerName,
		baseUrl,
		nodeId: principalNode.id,
		createdAt: nowTs
	};

	const seeded: PrinterSnapshot = {
		nodes: [principalNode],
		printers: [principalPrinter],
		states: snapshot.states,
		updatedAt: nowTs
	};

	await writeSnapshotToDisk(seeded);
	return seeded;
};

export const getSnapshot = async (defaults?: {
	baseUrl?: string;
	printerName?: string;
}): Promise<PrinterSnapshot> => {
	if (cache && cache.expiresAt > now()) {
		return cache.snapshot;
	}

	let snapshot = await readSnapshotFromDisk();
	snapshot = await maybeSeedDefaults(snapshot, defaults);
	cache = {
		snapshot,
		expiresAt: now() + CACHE_TTL_MS
	};
	return snapshot;
};

export const registerPrinter = async (input: {
	name: string;
	baseUrl: string;
	nodeId?: string;
	nodeName?: string;
}): Promise<PrinterSnapshot> => {
	const name = input.name.trim();
	const baseUrl = input.baseUrl.trim();
	if (!name) {
		throw new Error('El nombre de la impresora es obligatorio.');
	}
	if (!baseUrl) {
		throw new Error('La URL base es obligatoria.');
	}

	return updateSnapshot((current) => {
		const nodes = [...current.nodes];
		const printers = [...current.printers];
		const states = current.states ? { ...current.states } : undefined;

		let targetNodeId = input.nodeId;
		const nodeExists = targetNodeId ? nodes.some((node) => node.id === targetNodeId) : false;

		if (!nodeExists) {
			const nodeName = input.nodeName?.trim();
			if (!nodeName) {
				throw new Error('El nodo de destino no es válido.');
			}
			const newNode: PrinterNode = {
				id: createId(),
				name: nodeName,
				createdAt: now()
			};
			nodes.push(newNode);
			targetNodeId = newNode.id;
		}

		const printer: PrinterConfig = {
			id: createId(),
			name,
			baseUrl,
			nodeId: targetNodeId!,
			createdAt: now()
		};

		printers.push(printer);

		if (states && states[printer.id]) {
			delete states[printer.id];
		}

		return {
			nodes,
			printers,
			states,
			updatedAt: current.updatedAt
		};
	});
};

export const removePrinter = async (printerId: string): Promise<PrinterSnapshot> => {
	if (!printerId) {
		throw new Error('Se requiere el identificador de la impresora.');
	}

	return updateSnapshot((current) => {
		const printers = current.printers.filter((printer) => printer.id !== printerId);
		if (printers.length === current.printers.length) {
			throw new Error('La impresora indicada no existe.');
		}

		const states = current.states ? { ...current.states } : undefined;
		if (states) {
			delete states[printerId];
		}

		return {
			nodes: current.nodes,
			printers,
			states,
			updatedAt: current.updatedAt
		};
	});
};

export const removeNode = async (nodeId: string): Promise<PrinterSnapshot> => {
	if (!nodeId) {
		throw new Error('Se requiere el identificador del nodo.');
	}

	return updateSnapshot((current) => {
		const nodes = current.nodes.filter((node) => node.id !== nodeId);
		if (nodes.length === current.nodes.length) {
			throw new Error('El nodo indicado no existe.');
		}

		const printers = current.printers.filter((printer) => printer.nodeId !== nodeId);
		let states = current.states ? { ...current.states } : undefined;
		if (states) {
			for (const printerId of Object.keys(states)) {
				if (!printers.some((printer) => printer.id === printerId)) {
					delete states[printerId];
				}
			}
			if (Object.keys(states).length === 0) {
				states = undefined;
			}
		}

		return {
			nodes,
			printers,
			states,
			updatedAt: current.updatedAt
		};
	});
};

export const upsertPrinterStates = async (
	entries: Record<string, StoredPrinterState>
): Promise<PrinterSnapshot> => {
	return updateSnapshot((current) => {
		const activePrinterIds = new Set(current.printers.map((printer) => printer.id));
		const states = current.states ? { ...current.states } : {};

		for (const [printerId, summary] of Object.entries(entries)) {
			if (!activePrinterIds.has(printerId) || !isValidState(summary)) {
				continue;
			}
			states[printerId] = summary;
		}

		return {
			nodes: current.nodes,
			printers: current.printers,
			states: Object.keys(states).length > 0 ? states : undefined,
			updatedAt: current.updatedAt
		};
	});
};

export const clearCache = () => {
	cache = null;
};
