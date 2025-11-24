<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import Button from '$lib/components/base/Button.svelte';
	import ProgressBar from '$lib/components/base/ProgressBar.svelte';
	import Modal from '$lib/components/overlays/Modal.svelte';
	import type {
		PrinterConfig,
		PrinterNode,
		PrinterSnapshot,
		PrinterStateSummary,
		StateVariant,
		StoredPrinterState
	} from '$lib/types/printer-registry';

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

	type RegistryMutation =
		| {
				action: 'add-printer';
				name: string;
				baseUrl: string;
				nodeId?: string;
				nodeName?: string;
			}
		| {
				action: 'remove-printer';
				printerId: string;
			}
		| {
				action: 'remove-node';
				nodeId: string;
			}
		| {
				action: 'sync-states';
				states: Record<string, StoredPrinterState>;
			};

	export let data: {
		baseUrl: string;
		overview: OverviewResponse;
		status: StatusResponse;
		registry: PrinterSnapshot;
	};

	const collator = new Intl.Collator('es', { sensitivity: 'base' });
	const defaultBaseUrl = data.baseUrl;
	const statusInitial = data.status.ok ? data.status.data : null;
	const registryInitial = data.registry;
	const REGISTRY_ENDPOINT = '/api/printer-registry';

	const cloneNodes = (entries: PrinterNode[]) => entries.map((entry) => ({ ...entry }));
	const clonePrinters = (entries: PrinterConfig[]) => entries.map((entry) => ({ ...entry }));

	let nodes: PrinterNode[] = cloneNodes(registryInitial.nodes);
	let printers: PrinterConfig[] = clonePrinters(registryInitial.printers);
	let collapsedNodes = new Set<string>();
	let groupedNodes: { node: PrinterNode; printers: PrinterConfig[] }[] = [];
	let printerCount = 0;
	let hasPrinters = false;

	let addModalOpen = false;
	let removeModalOpen = false;
	let newPrinterName = '';
	let newPrinterBaseUrl = '';
	let selectedNodeId = '';
	let newNodeName = '';
	let removeSelection: string | null = null;
	let removeNodeId = '';
	let removeNodePrinters: PrinterConfig[] = [];
	let hydrated = false;
	let printerStates: Record<string, PrinterStateSummary> = {};
	const fetchingStates = new Set<string>();
	const REFRESH_INTERVAL = 45_000;
	let stateInterval: ReturnType<typeof setInterval> | null = null;
	let registryPending = false;
	let registryError: string | null = null;
	let stateSyncTimer: ReturnType<typeof setTimeout> | null = null;

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

	const defaultPrinterName = extractDeviceName(statusInitial) ?? 'Impresora principal';

		const defaultPrinterState: PrinterStateSummary = {
			label: 'Desconocido',
			variant: 'unknown',
			progress: null,
			fetching: false,
			error: null,
			updatedAt: null,
			message: null
		};

	const generateId = () =>
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

		const ensurePrinterState = (printer: PrinterConfig) => {
			if (printerStates[printer.id]) return;
			printerStates = {
				...printerStates,
				[printer.id]: { ...defaultPrinterState, fetching: true }
			};
		};

		let refreshingAllStates = false;

		const resolveStateDisplay = (raw: string | null): { label: string; variant: StateVariant } => {
			if (!raw) return { label: 'Desconocido', variant: 'unknown' };
			const normalized = raw.toLowerCase();
			if (normalized.includes('print')) return { label: 'Imprimiendo', variant: 'printing' };
			if (normalized.includes('complete') || normalized.includes('done') || normalized.includes('finish')) {
				return { label: 'Completado', variant: 'complete' };
			}
			if (normalized.includes('pause')) return { label: 'Pausado', variant: 'paused' };
			if (normalized.includes('standby') || normalized.includes('idle') || normalized.includes('ready')) {
				return { label: 'Standby', variant: 'idle' };
			}
			if (normalized.includes('error') || normalized.includes('fault') || normalized.includes('halt')) {
				return { label: 'Error', variant: 'error' };
			}
			return { label: raw, variant: 'unknown' };
		};

		const resolveProgress = (value: number | null | undefined) => {
			if (value === null || value === undefined || Number.isNaN(value)) return null;
			const progress = value <= 1 ? value * 100 : value;
			return Math.max(0, Math.min(100, progress));
		};

		const setPrinterState = (id: string, patch: Partial<PrinterStateSummary>) => {
			const next = {
				...defaultPrinterState,
				...(printerStates[id] ?? {}),
				...patch
			};
			printerStates = {
				...printerStates,
				[id]: next
			};
		};

		const normalizeBaseUrl = (value: string) => value.replace(new RegExp('/+$'), '');

		const serializePrinterStates = (activePrinters: PrinterConfig[]): Record<string, StoredPrinterState> => {
			const entries: [string, StoredPrinterState][] = [];
			for (const printer of activePrinters) {
				const summary = printerStates[printer.id];
				if (!summary) continue;
				const { fetching, ...rest } = summary;
				entries.push([printer.id, rest]);
			}
			return Object.fromEntries(entries);
		};

		const syncPrinterStates = async () => {
			if (!browser) return;
			const payload = serializePrinterStates(printers);
			if (Object.keys(payload).length === 0) return;
			try {
				const response = await fetch(REGISTRY_ENDPOINT, {
					method: 'POST',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ action: 'sync-states', states: payload })
				});
				const registryResponse = (await response.json().catch(() => null)) as
					| { ok: true; snapshot: PrinterSnapshot }
					| { ok: false; error: string }
					| null;
				if (!response.ok || !registryResponse || !registryResponse.ok) {
					const message = registryResponse && 'error' in registryResponse ? registryResponse.error : `Registro respondió ${response.status}`;
					throw new Error(message);
				}
			} catch (error) {
				console.warn('[Impresoras] no se pudo sincronizar el estado compartido', error);
			}
		};

		const scheduleStateSync = () => {
			if (!browser) return;
			if (stateSyncTimer) return;
			stateSyncTimer = setTimeout(() => {
				stateSyncTimer = null;
				void syncPrinterStates();
			}, 800);
		};

		const restorePrinterStates = (
			stored: Record<string, StoredPrinterState> | undefined,
			activePrinters: PrinterConfig[]
		) => {
			if (!stored) return;
			const activeIds = new Set(activePrinters.map((printer) => printer.id));
			const restoredEntries = Object.entries(stored)
				.filter(([id]) => activeIds.has(id))
				.map(([id, summary]) => [
					id,
					{
						...defaultPrinterState,
						...summary,
						fetching: false
					}
				] as const);
			if (restoredEntries.length > 0) {
				printerStates = Object.fromEntries(restoredEntries);
			}
		};

	restorePrinterStates(registryInitial.states, printers);

		const seedStateFromInitialStatus = (printer: PrinterConfig) => {
			if (!statusInitial) return;
			if (printerStates[printer.id]) return;
			const normalizedBase = normalizeBaseUrl(printer.baseUrl);
			const normalizedDefault = normalizeBaseUrl(defaultBaseUrl);
			if (normalizedBase !== normalizedDefault) return;
			const rawText = typeof statusInitial?.state?.text === 'string' ? statusInitial.state.text : null;
			const message = typeof statusInitial?.state?.message === 'string' ? statusInitial.state.message : null;
			const display = resolveStateDisplay(rawText);
			setPrinterState(printer.id, {
				label: display.label,
				variant: display.variant,
				progress: null,
				fetching: false,
				error: null,
				updatedAt: Date.now(),
				message
			});
		};

	for (const printer of printers) {
		seedStateFromInitialStatus(printer);
			ensurePrinterState(printer);
	}

		const applySnapshot = (snapshot: PrinterSnapshot) => {
			const nextNodes = cloneNodes(snapshot.nodes);
			const nextPrinters = clonePrinters(snapshot.printers);
			nodes = nextNodes;
			printers = nextPrinters;
			printerStates = {};
			restorePrinterStates(snapshot.states, nextPrinters);
			for (const printer of nextPrinters) {
				seedStateFromInitialStatus(printer);
				ensurePrinterState(printer);
			}
		};

		const refreshRegistrySnapshot = async () => {
			if (!browser) return;
			registryError = null;
			try {
				const params = new URLSearchParams({
					baseUrl: defaultBaseUrl,
					printerName: defaultPrinterName
				});
				const response = await fetch(`${REGISTRY_ENDPOINT}?${params.toString()}`, {
					headers: {
						Accept: 'application/json'
					}
				});
				const payload = (await response.json().catch(() => null)) as
					| { ok: true; snapshot: PrinterSnapshot }
					| { ok: false; error: string }
					| null;
				if (!response.ok || !payload || !payload.ok) {
					const message = payload && 'error' in payload ? payload.error : `Registro respondió ${response.status}`;
					throw new Error(message);
				}
				applySnapshot(payload.snapshot);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'No se pudo actualizar el registro de impresoras';
				registryError = message;
				console.warn('[Impresoras] actualización de registro fallida', error);
			}
		};

		const mutateRegistry = async (mutation: RegistryMutation): Promise<PrinterSnapshot> => {
			if (!browser) {
				throw new Error('Las mutaciones solo pueden ejecutarse en el navegador.');
			}
			registryPending = true;
			registryError = null;
			try {
				const response = await fetch(REGISTRY_ENDPOINT, {
					method: 'POST',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(mutation)
				});
				const payload = (await response.json().catch(() => null)) as
					| { ok: true; snapshot: PrinterSnapshot }
					| { ok: false; error: string }
					| null;
				if (!response.ok || !payload || !payload.ok) {
					const message = payload && 'error' in payload ? payload.error : `Registro respondió ${response.status}`;
					throw new Error(message);
				}
				applySnapshot(payload.snapshot);
				return payload.snapshot;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'No se pudo aplicar la operación solicitada';
				registryError = message;
				console.warn('[Impresoras] mutación del registro fallida', error);
				throw error instanceof Error ? error : new Error(String(error));
			} finally {
				registryPending = false;
			}
		};

		const refreshPrinterState = async (printer: PrinterConfig) => {
			if (!browser) return;
			ensurePrinterState(printer);
			if (fetchingStates.has(printer.id)) return;
			fetchingStates.add(printer.id);
			setPrinterState(printer.id, { fetching: true, error: null });

			try {
				const params = new URLSearchParams({ baseUrl: printer.baseUrl });
				const response = await fetch(`/api/printer-overview?${params.toString()}`);
				const payload = (await response.json().catch(() => null)) as
					| { ok: true; data: OverviewData; baseUrl: string }
					| { ok: false; error: string }
					| null;

				if (!response.ok || !payload || !payload.ok) {
					const message = payload && !payload.ok ? payload.error : `Moonraker respondió ${response.status}`;
					throw new Error(message);
				}

				const display = resolveStateDisplay(payload.data.print?.state ?? null);
				const progress = resolveProgress(payload.data.print?.progress ?? null);
				const message = payload.data.print?.message ?? null;
				setPrinterState(printer.id, {
					label: display.label,
					variant: display.variant,
					progress,
					message,
					fetching: false,
					error: null,
					updatedAt: Date.now()
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : 'No se pudo leer el estado';
				setPrinterState(printer.id, {
					fetching: false,
					error: message,
					variant: 'error',
					label: 'Error',
					message: null
				});
			} finally {
				fetchingStates.delete(printer.id);
				scheduleStateSync();
			}
		};

		const refreshAllPrinterStates = async () => {
			if (!browser) return;
			await Promise.all(printers.map((printer) => refreshPrinterState(printer)));
		};

		const startStatePolling = () => {
			if (!browser || stateInterval) return;
			stateInterval = setInterval(() => {
				void refreshAllPrinterStates();
			}, REFRESH_INTERVAL);
			void refreshAllPrinterStates();
		};

		const stopStatePolling = () => {
			if (!stateInterval) return;
			clearInterval(stateInterval);
			stateInterval = null;
		};

	 	const handleRefreshAllStates = async () => {
			if (refreshingAllStates) return;
			refreshingAllStates = true;
			try {
				await refreshAllPrinterStates();
			} finally {
				refreshingAllStates = false;
			}
		};

	onMount(() => {
		hydrated = true;
		if (!selectedNodeId && nodes.length > 0) {
			selectedNodeId = nodes[0].id;
		}
		void refreshRegistrySnapshot();
		void refreshAllPrinterStates();
		startStatePolling();
	});

	onDestroy(() => {
		stopStatePolling();
		if (stateSyncTimer) {
			clearTimeout(stateSyncTimer);
			stateSyncTimer = null;
		}
	});

	$: groupedNodes = nodes
		.slice()
		.sort((a, b) => collator.compare(a.name, b.name))
		.map((node) => ({
			node,
			printers: printers
				.filter((printer) => printer.nodeId === node.id)
				.slice()
				.sort((a, b) => collator.compare(a.name, b.name))
		}));

	$: {
		if (selectedNodeId && selectedNodeId !== 'new' && !nodes.some((node) => node.id === selectedNodeId)) {
			selectedNodeId = nodes[0]?.id ?? '';
		}
	}

	$: if (hydrated && !selectedNodeId && nodes.length > 0) {
		selectedNodeId = nodes[0].id;
	}

	$: if (hydrated) {
		const activeIds = new Set(printers.map((printer) => printer.id));
		const currentEntries = Object.entries(printerStates);
		if (currentEntries.some(([id]) => !activeIds.has(id))) {
			const filtered = currentEntries.filter(([id]) => activeIds.has(id));
			printerStates = Object.fromEntries(filtered);
		}

		for (const printer of printers) {
			if (!printerStates[printer.id]) {
				ensurePrinterState(printer);
				void refreshPrinterState(printer);
			}
		}

		if (hasPrinters) {
			startStatePolling();
		} else {
			stopStatePolling();
		}

		console.debug('[Impresoras] contadores', {
			nodes: nodes.length,
			printers: printerCount,
			tieneImpresoras: hasPrinters
		});
	}

	$: printerCount = printers.length;
	$: hasPrinters = printerCount > 0;

	$: if (removeNodeId && !nodes.some((node) => node.id === removeNodeId)) {
		removeNodeId = nodes.find((node) => nodeHasPrinters(node.id))?.id ?? nodes[0]?.id ?? '';
	}

	$: removeNodePrinters = removeNodeId
		? printers
			.filter((printer) => printer.nodeId === removeNodeId)
			.slice()
			.sort((a, b) => collator.compare(a.name, b.name))
		: [];

	$: if (removeNodeId) {
		const available = removeNodePrinters;
		if (!removeSelection && available.length > 0) {
			removeSelection = available[0].id;
		} else if (removeSelection && !available.some((printer) => printer.id === removeSelection)) {
			removeSelection = available[0]?.id ?? null;
		}
		console.debug('[Impresoras] nodo seleccionado para eliminar', {
			nodo: removeNodeId,
			impresoras: available.length
		});
	} else if (removeSelection) {
		removeSelection = null;
	}

	const resetAddForm = () => {
		newPrinterName = '';
		newPrinterBaseUrl = defaultBaseUrl;
		newNodeName = '';
		selectedNodeId = nodes[0]?.id ?? 'new';
	};

	const openAddModal = () => {
		resetAddForm();
		addModalOpen = true;
	};

	const openRemoveModal = () => {
		const nodesWithPrinters = nodes.filter((node) => nodeHasPrinters(node.id));
		removeNodeId = nodesWithPrinters[0]?.id ?? nodes[0]?.id ?? '';
		const initialList = removeNodeId ? printers.filter((printer) => printer.nodeId === removeNodeId) : [];
		removeSelection = initialList[0]?.id ?? null;
		console.debug('[Impresoras] abrir modal de eliminación', {
			nodeSeleccionado: removeNodeId,
			impresorasDisponibles: initialList.length
		});
		removeModalOpen = true;
	};

	const toggleNodeCollapse = (nodeId: string) => {
		const next = new Set(collapsedNodes);
		if (next.has(nodeId)) {
			next.delete(nodeId);
		} else {
			next.add(nodeId);
		}
		collapsedNodes = next;
	};

	const handleAddPrinter = async () => {
		if (registryPending) return;
		const name = newPrinterName.trim();
		const baseUrl = newPrinterBaseUrl.trim();
		const wantsNewNode = selectedNodeId === 'new';
		const customNode = newNodeName.trim();

		if (!name || !baseUrl) {
			return;
		}

		if (wantsNewNode && !customNode) {
			return;
		}

		try {
			const snapshot = await mutateRegistry({
				action: 'add-printer',
				name,
				baseUrl,
				nodeId: wantsNewNode ? undefined : selectedNodeId,
				nodeName: wantsNewNode ? customNode : undefined
			});

			if (wantsNewNode) {
				const created = snapshot.nodes.find((node) => node.name === customNode);
				if (created) {
					selectedNodeId = created.id;
				}
			}

			addModalOpen = false;
		} catch (error) {
			console.warn('[Impresoras] no se pudo añadir la impresora', error);
		}
	};

	const handleRemovePrinter = async () => {
		if (registryPending || !removeSelection) {
			return;
		}

		try {
			await mutateRegistry({
				action: 'remove-printer',
				printerId: removeSelection
			});
			removeModalOpen = false;
			removeSelection = null;
		} catch (error) {
			console.warn('[Impresoras] no se pudo eliminar la impresora', error);
		}
	};

	const handleRemoveNode = async (nodeId: string) => {
		if (registryPending) return;
		const node = nodes.find((entry) => entry.id === nodeId);
		if (!node) {
			return;
		}

		const associatedPrinters = printers.filter((printer) => printer.nodeId === nodeId);
		const printerTotal = associatedPrinters.length;
		const promptMessage = `¿Eliminar el nodo "${node.name}" y ${printerTotal} impresora${printerTotal === 1 ? '' : 's'} asociada${printerTotal === 1 ? '' : 's'}?`;

		if (browser && !window.confirm(promptMessage)) {
			return;
		}

		try {
			await mutateRegistry({
				action: 'remove-node',
				nodeId
			});
			if (removeNodeId === nodeId) {
				removeNodeId = '';
				removeSelection = null;
			}
		} catch (error) {
			console.warn('[Impresoras] no se pudo eliminar el nodo', error);
		}
	};

	const viewPrinter = (printer: PrinterConfig, node: PrinterNode) => {
		const search = new URLSearchParams({
			baseUrl: printer.baseUrl,
			name: printer.name,
			node: node.name
		});
		goto(`/printers/${encodeURIComponent(printer.id)}?${search.toString()}`);
	};

	const totalPrinters = () => printerCount;

	const nodeHasPrinters = (nodeId: string) => printers.some((printer) => printer.nodeId === nodeId);

	const effectiveRemoveSelection = () =>
		printers.find((printer) => printer.id === removeSelection) ?? null;

	let addDisabled = true;
	$: addDisabled =
		registryPending ||
		!newPrinterName.trim() ||
		!newPrinterBaseUrl.trim() ||
		!selectedNodeId ||
		(selectedNodeId === 'new' && !newNodeName.trim());

	const removeDisabled = () => registryPending || removeNodePrinters.length === 0 || !removeSelection;
</script>

<section class="mx-auto flex max-w-6xl flex-col gap-6 p-5 sm:p-8">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold text-foreground sm:text-4xl">Impresoras</h1>
			<p class="text-sm text-muted">Organiza y accede a cada equipo por nodo.</p>
		</div>
		<div class="flex flex-wrap gap-3">
			<Button
				variant="outline"
				size="sm"
				disabled={!hasPrinters || refreshingAllStates}
				on:click={handleRefreshAllStates}
			>
				<svg
					class={`h-4 w-4 ${refreshingAllStates ? 'animate-spin' : ''}`}
					viewBox="0 0 20 20"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					aria-hidden="true"
				>
					<path d="M4 10a6 6 0 0 1 10-4" stroke-linecap="round" />
					<path d="M16 10a6 6 0 0 1-10 4" stroke-linecap="round" />
					<path d="M4 4v4h4" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M16 16v-4h-4" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<span>{refreshingAllStates ? 'Actualizando…' : 'Actualizar estados'}</span>
			</Button>
			<Button size="sm" on:click={openAddModal} disabled={registryPending}>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
					<path d="M10 4v12" stroke-linecap="round" />
					<path d="M4 10h12" stroke-linecap="round" />
				</svg>
				<span>Añadir</span>
			</Button>
			<Button size="sm" variant="outline" disabled={!hasPrinters || registryPending} on:click={openRemoveModal}>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
					<path d="M6 6h8" stroke-linecap="round" />
					<path d="M8 6v8" stroke-linecap="round" />
					<path d="M12 6v8" stroke-linecap="round" />
					<path d="M5 6l1-2h8l1 2" stroke-linecap="round" />
					<path d="M5 8h10l-.6 7a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z" stroke-linejoin="round" />
				</svg>
				<span>Eliminar</span>
			</Button>
		</div>
	</header>

	{#if registryError}
		<p class="rounded-lg border border-rose-400/60 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
			{registryError}
		</p>
	{/if}

	{#if groupedNodes.length === 0}
		<p class="rounded-xl border border-dashed border-border/60 bg-surface/60 p-6 text-center text-sm text-muted">
			No hay impresoras registradas todavía.
		</p>
	{:else}
		<div class="flex flex-col gap-6">
			{#each groupedNodes as { node, printers: nodePrinters } (node.id)}
				<section class="rounded-xl border border-border/60 bg-surface/70">
					<header class="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex items-center gap-3">
							<button
								type="button"
								class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-surface text-muted transition hover:text-accent"
								on:click={() => toggleNodeCollapse(node.id)}
								aria-expanded={!collapsedNodes.has(node.id)}
								aria-controls={`node-${node.id}`}
							>
								{#if collapsedNodes.has(node.id)}
									<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
										<path d="M6 12l4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{:else}
									<svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
										<path d="M6 8l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{/if}
							</button>
							<div>
								<p class="text-base font-semibold text-foreground">{node.name}</p>
								<p class="text-xs text-muted">{nodePrinters.length} impresoras</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={!nodeHasPrinters(node.id)}
								on:click={() => toggleNodeCollapse(node.id)}
							>
								<span class="text-xs uppercase tracking-[0.3em] text-muted">{collapsedNodes.has(node.id) ? 'Mostrar' : 'Ocultar'}</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="border-rose-400 text-rose-300 hover:border-rose-400 hover:bg-rose-500/10 hover:text-rose-100"
								on:click={() => handleRemoveNode(node.id)}
								disabled={registryPending}
							>
								
								<span class="text-xs uppercase tracking-[0.3em]">Eliminar nodo</span>
							</Button>
						</div>
					</header>
					{#if !collapsedNodes.has(node.id)}
						{#if nodePrinters.length === 0}
							<p class="px-5 py-6 text-sm text-muted">Este nodo no tiene impresoras asignadas.</p>
						{:else}
							<div id={`node-${node.id}`} class="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
								{#each nodePrinters as printer (printer.id)}
									{@const summary = printerStates[printer.id] ?? defaultPrinterState}
									<button
										type="button"
										on:click={() => viewPrinter(printer, node)}
										class="group flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-muted/40 p-4 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_18px_45px_-40px_rgba(255,111,0,0.85)]"
									>
										<div class="flex items-start justify-between gap-4">
											<div>
												<p class="text-sm font-semibold text-foreground group-hover:text-accent">{printer.name}</p>
												<p class="text-xs text-muted">{printer.baseUrl}</p>
											</div>
											<div class="flex flex-col items-end gap-2 text-right">
												<div class="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface-muted/50 px-3 py-1 text-xs font-medium">
													<span
														class="h-2.5 w-2.5 rounded-full transition-colors"
														class:bg-emerald-500={summary.variant === 'printing'}
														class:bg-sky-500={summary.variant === 'idle'}
														class:bg-amber-500={summary.variant === 'paused'}
														class:bg-lime-500={summary.variant === 'complete'}
														class:bg-rose-500={summary.variant === 'error'}
														class:bg-slate-500={summary.variant === 'unknown'}
													></span>
													<span
														class="whitespace-nowrap transition-colors"
														class:text-emerald-300={summary.variant === 'printing'}
														class:text-sky-300={summary.variant === 'idle'}
														class:text-amber-300={summary.variant === 'paused'}
														class:text-lime-300={summary.variant === 'complete'}
														class:text-rose-300={summary.variant === 'error'}
														class:text-muted={summary.variant === 'unknown'}
													>
														{summary.label}
													</span>
												</div>
												{#if summary.fetching && !summary.updatedAt}
													<span class="text-[10px] uppercase tracking-[0.25em] text-muted">Actualizando…</span>
												{:else if summary.error}
													<span class="text-[10px] uppercase tracking-[0.25em] text-rose-300">{summary.error}</span>
												{:else if summary.updatedAt}
													<span class="text-[10px] uppercase tracking-[0.25em] text-muted">{new Date(summary.updatedAt).toLocaleTimeString()}</span>
												{/if}
											</div>
										</div>
										{#if summary.message}
											<p class="text-[11px] text-muted/80">
												{summary.message}
											</p>
										{/if}
										{#if summary.variant === 'printing' && summary.progress !== null}
											<div class="flex flex-col gap-1">
												<div class="overflow-hidden rounded-full">
													<ProgressBar value={summary.progress} />
												</div>
												<span class="text-[11px] text-muted">{summary.progress.toFixed(1)}%</span>
											</div>
										{/if}
										<div class="flex items-center gap-2 text-xs text-muted">
											<svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4">
												<path d="M5 8l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
												<path d="M5 12l5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
											</svg>
											<span>{node.name}</span>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</section>

<Modal bind:open={addModalOpen} title="Añadir impresora" description="Registra una impresora y asígnala a un nodo">
	<form class="space-y-4" on:submit|preventDefault={handleAddPrinter}>
		<div class="space-y-1">
			<label class="text-xs font-semibold uppercase tracking-[0.3em] text-muted" for="printer-name">Nombre</label>
			<input
				required
				id="printer-name"
				type="text"
				class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
				bind:value={newPrinterName}
				placeholder="Ej. Kossel 01"
			/>
		</div>
		<div class="space-y-1">
			<label class="text-xs font-semibold uppercase tracking-[0.3em] text-muted" for="printer-base-url">URL base</label>
			<input
				required
				id="printer-base-url"
				type="url"
				class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
				bind:value={newPrinterBaseUrl}
				placeholder="http://192.168.1.17"
			/>
		</div>
		<div class="space-y-2">
			<label class="text-xs font-semibold uppercase tracking-[0.3em] text-muted" for="printer-node">Nodo</label>
			<select
				id="printer-node"
				class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
				bind:value={selectedNodeId}
			>
				{#each nodes as node (node.id)}
					<option value={node.id}>{node.name}</option>
				{/each}
				<option value="new">Crear nuevo nodo…</option>
			</select>
			{#if selectedNodeId === 'new'}
				<input
					required
					class="w-full rounded-md border border-dashed border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
					bind:value={newNodeName}
					placeholder="Nombre del nuevo nodo"
				/>
			{/if}
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<Button type="button" variant="ghost" size="sm" on:click={() => (addModalOpen = false)}>Cancelar</Button>
			<Button type="submit" size="sm" disabled={addDisabled}>Guardar</Button>
		</div>
	</form>
</Modal>

<Modal bind:open={removeModalOpen} title="Eliminar impresora" description="Selecciona la impresora que deseas quitar">
	{#if printers.length === 0}
		<p class="text-sm text-muted">No hay impresoras para eliminar.</p>
	{:else}
		<form class="space-y-4" on:submit|preventDefault={handleRemovePrinter}>
			<div class="space-y-2">
				<label class="text-xs font-semibold uppercase tracking-[0.3em] text-muted" for="remove-node">Nodo</label>
				<select
					id="remove-node"
					class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
					bind:value={removeNodeId}
				>
					{#if nodes.length === 0}
						<option value="" disabled>Sin nodos registrados</option>
					{/if}
					{#each nodes as node (node.id)}
						<option value={node.id} disabled={!nodeHasPrinters(node.id)}>
							{node.name}
							{#if nodeHasPrinters(node.id)}
								&nbsp;·&nbsp;{printers.filter((printer) => printer.nodeId === node.id).length} impresoras
							{/if}
						</option>
					{/each}
				</select>
			</div>
			{#if removeNodeId === ''}
				<p class="text-xs text-muted">Selecciona un nodo para ver sus impresoras.</p>
			{:else if removeNodePrinters.length === 0}
				<p class="text-xs text-muted">Este nodo no tiene impresoras para eliminar.</p>
			{:else}
				<div class="space-y-2">
					<label class="text-xs font-semibold uppercase tracking-[0.3em] text-muted" for="remove-printer">Impresora</label>
					<select
						id="remove-printer"
						class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
						bind:value={removeSelection}
					>
						{#each removeNodePrinters as printer (printer.id)}
							<option value={printer.id}>{printer.name} · {printer.baseUrl}</option>
						{/each}
					</select>
				</div>
			{/if}
			{#if effectiveRemoveSelection()}
				<p class="text-xs text-muted">
					Se eliminará <span class="font-semibold text-foreground">{effectiveRemoveSelection()?.name}</span> del nodo
					<span class="font-semibold text-foreground">{nodes.find((node) => node.id === effectiveRemoveSelection()?.nodeId)?.name ?? 'desconocido'}</span>.
				</p>
			{/if}
			<div class="flex justify-end gap-2 pt-2">
				<Button type="button" variant="ghost" size="sm" on:click={() => (removeModalOpen = false)}>Cancelar</Button>
				<Button type="submit" size="sm" variant="outline" disabled={removeDisabled()}>Eliminar</Button>
			</div>
		</form>
	{/if}
</Modal>
