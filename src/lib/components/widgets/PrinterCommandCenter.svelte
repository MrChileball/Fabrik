<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import Button from '../base/Button.svelte';
	import Modal from '../overlays/Modal.svelte';

	const PRINTER_STORAGE_PREFIX = 'moonraker:printer:commands:';
	const PROFILE_STORAGE_KEY = 'moonraker:command-profiles';
	const CONSOLE_HISTORY_LIMIT = 200;
	const CONSOLE_HISTORY_POLL_MS = 15000;

	const collator = new Intl.Collator('es', { sensitivity: 'base', usage: 'search' });

	type FeedbackPayload = { type: 'success' | 'error'; text: string; at: number };
	type Feedback = FeedbackPayload | null;

	type MacroInfo = { name: string };

	type SidebarItem = { id: string; label: string; iconPath: string };

	type CommandDefinition = {
		id: string;
		label: string;
		script: string;
	};

	type ProfileCommandDraft = {
		id: string;
		label: string;
		script: string;
	};

	type CommandProfile = {
		id: string;
		name: string;
		commands: CommandDefinition[];
		createdAt: number;
		updatedAt: number;
	};

	type PrinterCommandSettings = {
		assignedProfiles: string[];
		customCommands: CommandDefinition[];
		lastUsedAt: number;
	};

	type ConsoleDirection = 'inbound' | 'outbound';
	type ConsoleStatus = 'idle' | 'connecting' | 'open' | 'error';

	type ConsoleEntryBase = {
		direction: ConsoleDirection;
		command: string | null;
		message: string | null;
		status: 'success' | 'error';
		origin: string;
		at: number;
	};

	type ConsoleEntry = ConsoleEntryBase & { id: string };
	type ConsoleEntryInput = ConsoleEntryBase & { id?: string };

	type CombinedCommand =
		| (CommandDefinition & {
				source: 'profile';
				profileId: string;
				profileName: string;
			})
		| (CommandDefinition & {
				source: 'custom';
			});

	type GcodeStoreItem =
		| {
				time?: number;
				ts?: number;
				message?: string;
				command?: string;
				response?: string;
				source?: string;
				origin?: string;
				type?: string;
				direction?: string;
				status?: string;
				data?: unknown;
			}
		| [number, string, string];

	export let baseUrl = 'http://192.168.1.17';
	export let printerId: string;
	export let printerName: string | null = null;

	const generateId = () => {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `id-${Math.random().toString(36).slice(2, 11)}`;
	};

	const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

	const defaultSettings = (): PrinterCommandSettings => ({
		assignedProfiles: [],
		customCommands: [],
		lastUsedAt: Date.now()
	});

	const readPrinterSettings = (id: string): PrinterCommandSettings => {
		if (!browser) return defaultSettings();
		const raw = localStorage.getItem(`${PRINTER_STORAGE_PREFIX}${id}`);
		if (!raw) return defaultSettings();
		try {
			const parsed = JSON.parse(raw) as Partial<PrinterCommandSettings> | null;
			const customCommands = Array.isArray(parsed?.customCommands)
				? parsed.customCommands
						.map((entry) => {
							if (!entry || typeof entry !== 'object') return null;
							const label = typeof (entry as { label?: unknown }).label === 'string' ? (entry as { label: string }).label.trim() : '';
							const script = typeof (entry as { script?: unknown }).script === 'string' ? (entry as { script: string }).script.trim() : '';
							if (!label || !script) return null;
							return {
								id:
									typeof (entry as { id?: unknown }).id === 'string' && (entry as { id: string }).id
										? (entry as { id: string }).id
										: generateId(),
								label,
								script
							};
						})
						.filter((command): command is CommandDefinition => Boolean(command))
				: [];
			const assignedProfiles = Array.isArray(parsed?.assignedProfiles)
				? parsed.assignedProfiles.filter((value): value is string => typeof value === 'string')
				: [];
			return {
				assignedProfiles,
				customCommands,
				lastUsedAt: typeof parsed?.lastUsedAt === 'number' ? parsed.lastUsedAt : Date.now()
			};
		} catch (error) {
			console.warn('[PrinterCommands] No se pudo leer los ajustes guardados', error);
			return defaultSettings();
		}
	};

	const writePrinterSettings = (id: string, settings: PrinterCommandSettings) => {
		if (!browser) return;
		try {
			localStorage.setItem(`${PRINTER_STORAGE_PREFIX}${id}`, JSON.stringify(settings));
		} catch (error) {
			console.warn('[PrinterCommands] No se pudo escribir los ajustes guardados', error);
		}
	};

	const readProfiles = (): CommandProfile[] => {
		if (!browser) return [];
		const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed
				.map((entry) => {
					if (!entry || typeof entry !== 'object') return null;
					const id =
						typeof (entry as { id?: unknown }).id === 'string' && (entry as { id: string }).id
							? (entry as { id: string }).id
							: generateId();
					const name = typeof (entry as { name?: unknown }).name === 'string' ? (entry as { name: string }).name : 'Perfil sin nombre';
					const createdAt = typeof (entry as { createdAt?: unknown }).createdAt === 'number' ? (entry as { createdAt: number }).createdAt : Date.now();
					const updatedAt = typeof (entry as { updatedAt?: unknown }).updatedAt === 'number' ? (entry as { updatedAt: number }).updatedAt : createdAt;
					const commandsSource = Array.isArray((entry as { commands?: unknown }).commands)
						? (entry as { commands: unknown[] }).commands
						: [];
					const commands = commandsSource
						.map((command) => {
							if (!command || typeof command !== 'object') return null;
							const label = typeof (command as { label?: unknown }).label === 'string' ? (command as { label: string }).label.trim() : '';
							const script = typeof (command as { script?: unknown }).script === 'string' ? (command as { script: string }).script.trim() : '';
							if (!label || !script) return null;
							return {
								id:
									typeof (command as { id?: unknown }).id === 'string' && (command as { id: string }).id
										? (command as { id: string }).id
										: generateId(),
								label,
								script
							};
						})
						.filter((command): command is CommandDefinition => Boolean(command));
					return {
						id,
						name,
						commands,
						createdAt,
						updatedAt
					};
				})
				.filter((profile): profile is CommandProfile => Boolean(profile));
		} catch (error) {
			console.warn('[PrinterCommands] No se pudo leer los perfiles guardados', error);
			return [];
		}
	};

	const writeProfiles = (entries: CommandProfile[]) => {
		if (!browser) return;
		try {
			localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(entries));
		} catch (error) {
			console.warn('[PrinterCommands] No se pudo escribir los perfiles', error);
		}
	};

	const sanitizeSettings = (input: PrinterCommandSettings, profileList: CommandProfile[]): PrinterCommandSettings => {
		const validProfileIds = new Set(profileList.map((profile) => profile.id));
		const filteredProfiles = input.assignedProfiles.filter((id) => validProfileIds.has(id));
		const seenCommands = new Set<string>();
		const dedupedCommands = input.customCommands.filter((command) => {
			const key = `${command.label.trim()}::${command.script.trim()}`;
			if (seenCommands.has(key)) {
				return false;
			}
			seenCommands.add(key);
			return true;
		});

		return {
			assignedProfiles: filteredProfiles,
			customCommands: dedupedCommands.map((command) => ({
				id: command.id ?? generateId(),
				label: command.label,
				script: command.script
			})),
			lastUsedAt: input.lastUsedAt ?? Date.now()
		};
	};

	let profiles: CommandProfile[] = [];
	let settings: PrinterCommandSettings = defaultSettings();
	let hydrated = false;
	let lastBaseUrl: string | null = null;

	let manualCommand = '';
	let manualFeedback: Feedback = null;
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	let pendingKeys = new Set<string>();

	let macros: MacroInfo[] = [];
	let macrosLoading = false;
	let macrosError: string | null = null;
	let macrosPage = 1;
	const MACRO_PAGE_OPTIONS = [15, 30, 50, 100] as const;
	let macrosPageSize: (typeof MACRO_PAGE_OPTIONS)[number] = 15;
	let macrosTotalPages = 1;
	let macrosPageItems: MacroInfo[] = [];
	let macrosSorted: MacroInfo[] = [];

	let consoleEntries: ConsoleEntry[] = [];
	let consoleEntryKeys = new Set<string>();
	let consoleStatus: ConsoleStatus = 'idle';
	let consoleError: string | null = null;
	let consoleIndicator: { text: string; dot: string; tone: string } = {
		text: 'Sin conexión',
		dot: 'bg-slate-500',
		tone: 'text-muted'
	};
	let consoleHistoryError: string | null = null;
	let consoleSocket: WebSocket | null = null;
	let consoleReconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let consoleReconnectAttempts = 0;
	let consoleShouldReconnect = false;
	let suppressConsoleReconnectOnce = false;
	let consoleHistoryInterval: ReturnType<typeof setInterval> | null = null;

	let sidebarHover: string | null = null;

	const floatingSidebarItems: SidebarItem[] = [
		{
			id: 'overview',
			label: 'Resumen',
			iconPath: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v2H4zm0 6h16v6a2 2 0 01-2 2H6a2 2 0 01-2-2zM10 14v2h4v-2z'
		},
		{
			id: 'motion',
			label: 'Movimiento',
			iconPath: 'M12 3l4 4h-3v6h-2V7H8zm-6 8l4 4H7v6H5v-6H2zm12 0l4 4h-3v6h-2v-6h-3z'
		},
		{
			id: 'console',
			label: 'Consola',
			iconPath: 'M5 4h14a1 1 0 011 1v10a1 1 0 01-1 1h-5l-4 4v-4H5a1 1 0 01-1-1V5a1 1 0 011-1z'
		},
		{
			id: 'macros',
			label: 'Macros',
			iconPath: 'M4 5h16v2H4zm0 4h12v2H4zm0 4h16v2H4zm0 4h12v2H4z'
		},
		{
			id: 'profiles',
			label: 'Perfiles',
			iconPath: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8v-1a5 5 0 015-5h4a5 5 0 015 5v1z'
		}
	];

	const setSidebarHover = (id: string | null) => {
		sidebarHover = id;
	};

	let combinedCommands: CombinedCommand[] = [];
	let customLabel = '';
	let customScript = '';
	let customError: string | null = null;

	let profileName = '';
	let profileCommands: ProfileCommandDraft[] = [{ id: generateId(), label: '', script: '' }];
	let profileError: string | null = null;
	let createProfileOpen = false;

	const buildConsoleEntryKey = (entry: ConsoleEntryInput | ConsoleEntry) =>
		`${entry.direction}:${entry.origin}:${entry.command ?? ''}:${entry.message ?? ''}:${entry.at}`;

	const seedConsoleEntries = (entries: ConsoleEntryInput[]) => {
		const trimmed = entries.slice(-CONSOLE_HISTORY_LIMIT);
		const keys = new Set<string>();
		const prepared: ConsoleEntry[] = [];
		for (let index = trimmed.length - 1; index >= 0; index -= 1) {
			const entry = trimmed[index];
			const key = buildConsoleEntryKey(entry);
			if (keys.has(key)) continue;
			const next: ConsoleEntry = { ...entry, id: entry.id ?? generateId() };
			keys.add(key);
			prepared.push(next);
			if (prepared.length >= CONSOLE_HISTORY_LIMIT) {
				break;
			}
		}
		consoleEntries = prepared;
		consoleEntryKeys = keys;
	};

	const clearConsole = () => {
		consoleEntries = [];
		consoleEntryKeys = new Set();
	};

	const clearConsoleHistoryInterval = () => {
		if (consoleHistoryInterval) {
			clearInterval(consoleHistoryInterval);
			consoleHistoryInterval = null;
		}
	};

	const resolveHistoryTimestamp = (value?: number) => {
		if (typeof value !== 'number' || Number.isNaN(value)) {
			return Date.now();
		}
		return value > 1_000_000_000_000 ? Math.trunc(value) : Math.trunc(value * 1000);
	};

	const fromGcodeStoreItem = (item: unknown): ConsoleEntryInput | null => {
		if (!item) {
			return null;
		}

		if (Array.isArray(item)) {
			const [time, hint, message] = item;
			const rawMessage = typeof message === 'string' ? message : typeof hint === 'string' ? hint : null;
			if (!rawMessage) return null;
			const trimmed = rawMessage.trim();
			const direction: ConsoleDirection = typeof hint === 'string' && /send|out/i.test(hint) ? 'outbound' : 'inbound';
			const status = trimmed.startsWith('!!') ? 'error' : 'success';
			return {
				direction,
				command: direction === 'outbound' ? trimmed : null,
				message: rawMessage,
				status,
				origin: direction === 'outbound' ? 'history' : 'klipper',
				at: resolveHistoryTimestamp(typeof time === 'number' ? time : undefined)
			};
		}

		if (typeof item !== 'object') {
			return null;
		}

		const record = item as Record<string, unknown>;
		const candidates: Array<string | null> = [
			typeof record.message === 'string' ? (record.message as string) : null,
			typeof record.response === 'string' ? (record.response as string) : null,
			typeof record.command === 'string' ? (record.command as string) : null,
			Array.isArray(record.data)
				? (record.data.filter((chunk) => typeof chunk === 'string') as string[]).join('\n')
				: typeof record.data === 'string'
				? (record.data as string)
				: null
		];
		const rawMessage = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0) ?? null;
		if (!rawMessage) {
			return null;
		}
		const trimmed = rawMessage.trim();
		const directionHint = typeof record.direction === 'string' ? (record.direction as string) : typeof record.type === 'string' ? (record.type as string) : '';
		const direction: ConsoleDirection = /out|send|command/i.test(directionHint) ? 'outbound' : 'inbound';
		const commandValue =
			typeof record.command === 'string'
				? (record.command as string)
				: direction === 'outbound'
				? trimmed
				: null;
		const timestampRaw = typeof record.time === 'number' ? (record.time as number) : typeof record.ts === 'number' ? (record.ts as number) : undefined;
		const origin =
			typeof record.source === 'string'
				? (record.source as string)
				: typeof record.origin === 'string'
				? (record.origin as string)
				: direction === 'outbound'
				? 'history'
				: 'klipper';
		const status: 'success' | 'error' =
			typeof record.status === 'string'
				? (record.status as string).toLowerCase() === 'error'
					? 'error'
					: 'success'
				: trimmed.startsWith('!!') || /error/i.test(trimmed)
				? 'error'
				: 'success';

		return {
			direction,
			command: commandValue,
			message: rawMessage,
			status,
			origin,
			at: resolveHistoryTimestamp(timestampRaw)
		};
	};

	const clearConsoleReconnectTimer = () => {
		if (consoleReconnectTimer) {
			clearTimeout(consoleReconnectTimer);
			consoleReconnectTimer = null;
		}
	};

	const buildConsoleWebSocketUrl = (raw: string): string | null => {
		try {
			const parsed = new URL(normalizeBaseUrl(raw) || raw);
			parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
			parsed.pathname = '/websocket';
			parsed.search = '';
			parsed.hash = '';
			return parsed.toString();
		} catch (error) {
			console.error('[PrinterCommands] URL base inválida para consola', error);
			return null;
		}
	};

	const addConsoleEntry = (entry: ConsoleEntryInput) => {
		const key = buildConsoleEntryKey(entry);
		if (consoleEntryKeys.has(key)) return;
		const next: ConsoleEntry = { ...entry, id: generateId() };
		const updated = [next, ...consoleEntries];
		consoleEntryKeys.add(key);
		while (updated.length > CONSOLE_HISTORY_LIMIT) {
			const removed = updated.pop();
			if (removed) {
				consoleEntryKeys.delete(buildConsoleEntryKey(removed));
			}
		}
		consoleEntries = updated;
	};

	const scheduleConsoleReconnect = () => {
		if (!consoleShouldReconnect) return;
		if (consoleReconnectTimer) return;
		const attempt = Math.min(consoleReconnectAttempts, 5);
		const delay = Math.min(1000 * 2 ** attempt, 15000);
		consoleReconnectTimer = setTimeout(() => {
			consoleReconnectTimer = null;
			if (!consoleShouldReconnect) return;
			connectConsoleStream();
		}, delay);
	};

	const handleConsoleMessage = (event: MessageEvent) => {
		let payload: unknown;
		try {
			payload = JSON.parse(event.data as string);
		} catch {
			return;
		}

		if (!payload || typeof payload !== 'object') {
			return;
		}

		const method = (payload as { method?: unknown }).method;
		if (typeof method !== 'string') {
			return;
		}

		if (method === 'notify_gcode_response') {
			const params = (payload as { params?: unknown }).params;
			const lines = Array.isArray(params) ? params : [];
			if (lines.length === 0) return;
			for (const raw of lines) {
				if (typeof raw !== 'string') continue;
				const trimmed = raw.trim();
				const status = trimmed.startsWith('!!') ? 'error' : 'success';
				addConsoleEntry({
					direction: 'inbound',
					command: null,
					origin: 'klipper',
					status,
					message: raw,
					at: Date.now()
				});
			}
			return;
		}

		if (method === 'notify_klippy_shutdown' || method === 'notify_klippy_disconnect') {
			addConsoleEntry({
				direction: 'inbound',
				command: null,
				origin: 'klipper',
				status: 'error',
				message: method === 'notify_klippy_shutdown' ? 'Klipper se detuvo.' : 'Klipper desconectado.',
				at: Date.now()
			});
			consoleStatus = 'error';
			consoleError = method === 'notify_klippy_shutdown' ? 'Klipper se detuvo.' : 'Klipper desconectado.';
		}

		if (method === 'notify_klippy_ready') {
			consoleStatus = 'open';
			consoleError = null;
			addConsoleEntry({
				direction: 'inbound',
				command: null,
				origin: 'klipper',
				status: 'success',
				message: 'Klipper listo.',
				at: Date.now()
			});
		}
	};

	const connectConsoleStream = () => {
		if (!browser) return;
		const wsUrl = buildConsoleWebSocketUrl(baseUrl);
		if (!wsUrl) {
			consoleStatus = 'error';
			consoleError = 'URL base inválida';
			return;
		}

		consoleShouldReconnect = true;
		clearConsoleReconnectTimer();
		consoleStatus = 'connecting';
		consoleError = null;

		let socket: WebSocket;
		try {
			socket = new WebSocket(wsUrl);
		} catch (error) {
			consoleStatus = 'error';
			consoleError = error instanceof Error ? error.message : 'No se pudo conectar a la consola';
			scheduleConsoleReconnect();
			return;
		}

		consoleSocket = socket;

		socket.addEventListener('open', () => {
			consoleReconnectAttempts = 0;
			consoleStatus = 'open';
			consoleError = null;
			try {
				socket.send(
					JSON.stringify({
						jsonrpc: '2.0',
						method: 'server.info',
						id: Date.now()
					})
				);
			} catch (error) {
				console.warn('[PrinterCommands] no se pudo enviar handshake de consola', error);
			}
			try {
				socket.send(
					JSON.stringify({
						jsonrpc: '2.0',
						method: 'server.connection.identify',
						params: {
							client_name: 'MoonrakerTEST UI',
							version: '0.1.0',
							type: 'web',
							url: 'https://github.com/moonrakerTEST'
						},
						id: Date.now() + 1
					})
				);
			} catch (error) {
				console.warn('[PrinterCommands] no se pudo identificar la conexión de consola', error);
			}
		});

		socket.addEventListener('message', handleConsoleMessage);

		socket.addEventListener('error', () => {
			consoleStatus = 'error';
			consoleError = 'Error de conexión';
		});

		socket.addEventListener('close', (event) => {
			if (consoleSocket === socket) {
				consoleSocket = null;
			}
			if (!consoleShouldReconnect) {
				return;
			}
			if (suppressConsoleReconnectOnce) {
				suppressConsoleReconnectOnce = false;
				return;
			}
			consoleReconnectAttempts += 1;
			consoleStatus = 'error';
			consoleError = `Conexión cerrada (${event.code})`;
			scheduleConsoleReconnect();
		});
	};

	const forceReconnectConsoleStream = () => {
		if (!browser) return;
		suppressConsoleReconnectOnce = true;
		if (consoleSocket) {
			consoleSocket.close();
			consoleSocket = null;
		}
		clearConsoleReconnectTimer();
		consoleReconnectAttempts = 0;
		connectConsoleStream();
	};

	const hydrateConsoleHistory = async (requestedBase?: string, mode: 'seed' | 'append' = 'seed') => {
		if (!browser) return;
		const baseCandidate = requestedBase ?? baseUrl;
		const normalizedTarget = normalizeBaseUrl(baseCandidate);
		const params = new URLSearchParams({
			baseUrl: baseCandidate,
			count: String(CONSOLE_HISTORY_LIMIT)
		});
		const endpoint = `/api/printer-console?${params.toString()}`;
		if (normalizeBaseUrl(baseUrl) === normalizedTarget) {
			consoleHistoryError = null;
		}
		try {
			const response = await fetch(endpoint);
			const payload = (await response.json().catch(() => null)) as
				| { ok: true; entries: GcodeStoreItem[] }
				| { ok: false; error: string }
				| null;

			if (normalizeBaseUrl(baseUrl) !== normalizedTarget) {
				return;
			}

			if (!response.ok || !payload || !payload.ok) {
				const message = payload && !payload.ok ? payload.error : `Moonraker respondió ${response.status}`;
				throw new Error(message);
			}

			const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
			const mapped = rawEntries
				.map((entry) => fromGcodeStoreItem(entry))
				.filter((entry): entry is ConsoleEntryInput => entry !== null);

			if (mode === 'seed') {
				seedConsoleEntries(mapped);
			} else {
				for (const entry of mapped) {
					addConsoleEntry(entry);
				}
			}
			consoleHistoryError = null;
		} catch (error) {
			if (normalizeBaseUrl(baseUrl) !== normalizedTarget) {
				return;
			}
			const message = error instanceof Error ? error.message : 'No se pudo leer el histórico de consola';
			consoleHistoryError = `Histórico no disponible (${message})`;
			console.warn('[PrinterCommands] no se pudo cargar el histórico de consola', error);
		}
	};

	const startConsoleHistoryInterval = () => {
		if (!browser) return;
		clearConsoleHistoryInterval();
		consoleHistoryInterval = setInterval(() => {
			void hydrateConsoleHistory(baseUrl, 'append');
		}, CONSOLE_HISTORY_POLL_MS);
	};

	const flashFeedback = (payload: Feedback) => {
		manualFeedback = payload;
		if (feedbackTimer) {
			clearTimeout(feedbackTimer);
		}
		if (payload) {
			feedbackTimer = setTimeout(() => {
				manualFeedback = null;
				feedbackTimer = null;
			}, 6000);
		}
	};

	const setPending = (key: string, active: boolean) => {
		const next = new Set(pendingKeys);
		if (active) {
			next.add(key);
		} else {
			next.delete(key);
		}
		pendingKeys = next;
	};

	const isPending = (key: string) => pendingKeys.has(key);

	const refreshMacros = async () => {
		if (!browser) return;
		macrosLoading = true;
		macrosError = null;
		try {
			const params = new URLSearchParams({ baseUrl });
			const response = await fetch(`/api/printer-macros?${params.toString()}`);
			const payload = (await response.json().catch(() => null)) as
				| { ok: true; macros: MacroInfo[]; baseUrl: string }
				| { ok: false; error: string }
				| null;

			if (!response.ok || !payload || !payload.ok) {
				const message = payload && !payload.ok ? payload.error : `Moonraker respondió ${response?.status}`;
				throw new Error(message);
			}

			macros = payload.macros ?? [];
		} catch (error) {
			const message = error instanceof Error ? error.message : 'No se pudo leer las macros';
			macrosError = message;
			macros = [];
		} finally {
			macrosLoading = false;
		}
	};

	const dispatchScript = async (script: string, origin: string) => {
		const trimmed = script.trim();
		if (!trimmed) {
			flashFeedback({ type: 'error', text: 'El comando está vacío.', at: Date.now() });
			return;
		}

		const key = `${origin}:${trimmed}`;
		if (isPending(key)) return;
		setPending(key, true);
		flashFeedback(null);

		try {
			const response = await fetch('/api/printer-control', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'gcode_script', baseUrl, value: trimmed })
			});

			const payload = (await response.json().catch(() => null)) as
				| { ok: true; message?: string }
				| { ok: false; error: string }
				| null;

			if (!response.ok || !payload || !payload.ok) {
				const message = payload && !payload.ok ? payload.error : `Moonraker respondió ${response.status}`;
				throw new Error(message);
			}

			const successMessage = payload.message ?? 'Comando enviado correctamente.';
			flashFeedback({ type: 'success', text: successMessage, at: Date.now() });
			addConsoleEntry({
				direction: 'outbound',
				command: trimmed,
				origin,
				status: 'success',
				message: successMessage,
				at: Date.now()
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : 'No se pudo enviar el comando';
			flashFeedback({ type: 'error', text: message, at: Date.now() });
			addConsoleEntry({
				direction: 'outbound',
				command: trimmed,
				origin,
				status: 'error',
				message,
				at: Date.now()
			});
		} finally {
			setPending(key, false);
		}
	};

	const addCustomCommand = () => {
		customError = null;
		const label = customLabel.trim();
		const script = customScript.trim();
		if (!label || !script) {
			customError = 'Completa etiqueta y comando.';
			return;
		}

		updateSettings((current) => {
			if (current.customCommands.some((command) => command.script === script)) {
				customError = 'El comando ya existe.';
				return current;
			}

			return {
				...current,
				customCommands: [
					...current.customCommands,
					{
						id: generateId(),
						label,
						script
					}
				]
			};
		});

		if (!customError) {
			customLabel = '';
			customScript = '';
		}
	};

	const removeCustomCommand = (id: string) => {
		updateSettings((current) => ({
			...current,
			customCommands: current.customCommands.filter((command) => command.id !== id)
		}));
	};

	const toggleProfileForPrinter = (profileId: string, active: boolean) => {
		updateSettings((current) => {
			const set = new Set(current.assignedProfiles);
			if (active) {
				set.add(profileId);
			} else {
				set.delete(profileId);
			}
			return {
				...current,
				assignedProfiles: Array.from(set)
			};
		});
	};

	const addMacroAsCustomCommand = (macroName: string) => {
		updateSettings((current) => {
			if (current.customCommands.some((command) => command.script === macroName)) {
				return current;
			}

			return {
				...current,
				customCommands: [
					...current.customCommands,
					{
						id: generateId(),
						label: macroName,
						script: macroName
					}
				]
			};
		});
	};

	const openCreateProfile = () => {
		profileName = printerName ? `${printerName} · Perfil` : 'Nuevo Perfil';
		profileCommands = [{ id: generateId(), label: '', script: '' }];
		profileError = null;
		createProfileOpen = true;
	};

	const addProfileCommandRow = () => {
		profileCommands = [...profileCommands, { id: generateId(), label: '', script: '' }];
	};

	const removeProfileCommandRow = (id: string) => {
		if (profileCommands.length === 1) return;
		profileCommands = profileCommands.filter((command) => command.id !== id);
	};

	const createProfile = () => {
		profileError = null;
		const name = profileName.trim();
		if (!name) {
			profileError = 'Indica un nombre para el perfil.';
			return;
		}

		const commands = profileCommands
			.map((entry) => ({
				id: entry.id ?? generateId(),
				label: entry.label.trim(),
				script: entry.script.trim()
			}))
			.filter((entry) => entry.label && entry.script);

		if (commands.length === 0) {
			profileError = 'Agrega al menos un comando.';
			return;
		}

		const profile: CommandProfile = {
			id: generateId(),
			name,
			commands,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};

		updateProfiles((current) => [...current, profile]);
		updateSettings((current) => ({
			...current,
			assignedProfiles: Array.from(new Set([...current.assignedProfiles, profile.id]))
		}));

		createProfileOpen = false;
	};

	const deleteProfile = (profile: CommandProfile) => {
		if (!browser) return;
		const confirmed = window.confirm(`¿Eliminar el perfil "${profile.name}"?`);
		if (!confirmed) return;

		updateProfiles((current) => current.filter((entry) => entry.id !== profile.id));
		updateSettings((current) => ({
			...current,
			assignedProfiles: current.assignedProfiles.filter((id) => id !== profile.id)
		}));
	};

	const updateProfiles = (mutator: (profiles: CommandProfile[]) => CommandProfile[]) => {
		const next = mutator(profiles);
		profiles = next;
		if (hydrated) {
			writeProfiles(profiles);
		}
	};

	const updateSettings = (mutator: (settings: PrinterCommandSettings) => PrinterCommandSettings) => {
		const next = mutator(settings);
		settings = { ...next, lastUsedAt: Date.now() };
		if (hydrated) {
			writePrinterSettings(printerId, settings);
		}
	};

	const profileMap = () => {
		const map = new Map<string, CommandProfile>();
		for (const profile of profiles) {
			map.set(profile.id, profile);
		}
		return map;
	};

	const isProfileAssigned = (profileId: string) => settings.assignedProfiles.includes(profileId);

	const handleManualSubmit = async () => {
		await dispatchScript(manualCommand, 'manual');
		if (manualFeedback && manualFeedback.type === 'success') {
			manualCommand = '';
		}
	};

	const goToMacrosPage = (page: number) => {
		const target = Math.min(Math.max(page, 1), macrosTotalPages);
		macrosPage = target;
	};

	const setMacrosPageSize = (size: (typeof MACRO_PAGE_OPTIONS)[number]) => {
		macrosPageSize = size;
		macrosPage = 1;
	};

	onMount(() => {
		if (!browser) return;
		const storedProfiles = readProfiles();
		profiles = storedProfiles;
		const storedSettings = sanitizeSettings(readPrinterSettings(printerId), storedProfiles);
		settings = storedSettings;
		hydrated = true;
		lastBaseUrl = baseUrl;

		void refreshMacros();
		void hydrateConsoleHistory(baseUrl, 'seed');
		startConsoleHistoryInterval();
		consoleShouldReconnect = true;
		connectConsoleStream();

		return () => {
			consoleShouldReconnect = false;
			clearConsoleReconnectTimer();
			clearConsoleHistoryInterval();
			if (consoleSocket) {
				consoleSocket.close();
				consoleSocket = null;
			}
		};
	});

	onDestroy(() => {
		consoleShouldReconnect = false;
		clearConsoleReconnectTimer();
		clearConsoleHistoryInterval();
		if (consoleSocket) {
			consoleSocket.close();
			consoleSocket = null;
		}
	});

	$: if (hydrated && normalizeBaseUrl(baseUrl) !== normalizeBaseUrl(lastBaseUrl ?? '')) {
		lastBaseUrl = baseUrl;
		consoleHistoryError = null;
		clearConsoleHistoryInterval();
		clearConsole();
		void refreshMacros();
		void hydrateConsoleHistory(baseUrl, 'seed');
		startConsoleHistoryInterval();
		forceReconnectConsoleStream();
	}

	$: macrosSorted = macros.slice().sort((a, b) => collator.compare(a.name, b.name));
	$: macrosTotalPages = Math.max(1, Math.ceil(macrosSorted.length / macrosPageSize));
	$: if (macrosPage > macrosTotalPages) {
		macrosPage = macrosTotalPages;
	}
	$: if (macrosPage < 1) {
		macrosPage = 1;
	}
	$: macrosPageItems = macrosSorted.slice((macrosPage - 1) * macrosPageSize, macrosPage * macrosPageSize);

	$: consoleIndicator = (() => {
		switch (consoleStatus) {
			case 'connecting':
				return { text: 'Conectando a Klipper…', dot: 'bg-amber-500', tone: 'text-amber-300' };
			case 'open':
				return { text: 'Conectado a Klipper', dot: 'bg-emerald-500', tone: 'text-emerald-300' };
			case 'error':
				return { text: 'Conexión con errores', dot: 'bg-rose-500', tone: 'text-rose-300' };
			default:
				return { text: 'Sin conexión', dot: 'bg-slate-500', tone: 'text-muted' };
		}
	})();

	$: if (hydrated) {
		const validIds = new Set(profiles.map((profile) => profile.id));
		if (settings.assignedProfiles.some((id) => !validIds.has(id))) {
			updateSettings((current) => ({
				...current,
				assignedProfiles: current.assignedProfiles.filter((id) => validIds.has(id))
			}));
		}
	}

	$: combinedCommands = (() => {
		const map = profileMap();
		const fromProfiles = settings.assignedProfiles.flatMap((profileId) => {
			const profile = map.get(profileId);
			if (!profile) return [];
			return profile.commands.map((command) => ({
				...command,
				source: 'profile' as const,
				profileId,
				profileName: profile.name
			}));
		});

		const custom = settings.customCommands.map((command) => ({
			...command,
			source: 'custom' as const
		}));

		return [...fromProfiles, ...custom].sort((a, b) => collator.compare(a.label, b.label));
	})();
</script>

<section class="rounded-xl border border-border/60 bg-surface/80 p-5 shadow-sm">
	<header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-lg font-semibold text-foreground">Comandos y macros</h2>
			<p class="text-sm text-muted">Administra comandos frecuentes y macros detectadas para {printerName}.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" on:click={openCreateProfile}>Nuevo perfil</Button>
			<Button variant="outline" size="sm" on:click={() => void refreshMacros()} disabled={macrosLoading}>
				{macrosLoading ? 'Consultando…' : 'Actualizar macros'}
			</Button>
		</div>
	</header>

	<div class="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
		<div class="space-y-5">
			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<p class="text-sm font-semibold text-foreground">Enviar comando manual</p>
				<p class="text-xs text-muted">Introduce un comando GCode o macro y envíalo a la impresora.</p>
				<form class="mt-3 space-y-3" on:submit|preventDefault={handleManualSubmit}>
					<textarea
						class="h-24 w-full resize-none rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
						bind:value={manualCommand}
						placeholder="Ej. M503"
					></textarea>
					<div class="flex items-center justify-between gap-3">
						<span class="text-xs text-muted">Se enviará directamente vía Moonraker.</span>
						<Button type="submit" size="sm" disabled={isPending(`manual:${manualCommand.trim()}`)}>Enviar</Button>
					</div>
				</form>
				{#if manualFeedback}
					<p class={`text-xs ${manualFeedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{manualFeedback.text}</p>
				{/if}
			</div>

			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm font-semibold text-foreground">Comandos guardados</p>
					{#if combinedCommands.length > 0}
						<span class="text-xs text-muted">{combinedCommands.length} comandos</span>
					{/if}
				</div>
				{#if combinedCommands.length === 0}
					<p class="mt-3 text-xs text-muted">No hay comandos guardados. Añade uno manual o asigna un perfil.</p>
				{:else}
					<ul class="mt-3 space-y-3">
						{#each combinedCommands as command (command.source === 'profile' ? `profile-${command.profileId}-${command.id}` : `custom-${command.id}`)}
							<li class="rounded-lg border border-border/60 bg-surface px-3 py-2">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="flex items-center gap-2">
										<span class="text-sm font-semibold text-foreground">{command.label}</span>
										{#if command.source === 'profile'}
											<span class="rounded-full bg-surface-muted/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-muted">{command.profileName}</span>
										{:else}
											<span class="rounded-full bg-surface-muted/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-muted">Personal</span>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											on:click={() => dispatchScript(command.script, command.source === 'profile' ? `profile:${command.id}` : `custom:${command.id}`)}
											disabled={isPending(command.source === 'profile' ? `profile:${command.id}` : `custom:${command.id}`)}
										>
											Ejecutar
										</Button>
										{#if command.source === 'custom'}
											<Button variant="ghost" size="sm" on:click={() => removeCustomCommand(command.id)}>Quitar</Button>
										{/if}
									</div>
								</div>
								<pre class="mt-2 overflow-x-auto text-xs text-muted">{command.script}</pre>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<p class="text-sm font-semibold text-foreground">Añadir comando a esta impresora</p>
				<div class="mt-3 space-y-2">
					<input
						class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
						placeholder="Etiqueta"
						bind:value={customLabel}
					/>
					<textarea
						class="h-20 w-full resize-none rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
						placeholder="Comando GCode"
						bind:value={customScript}
					></textarea>
					<div class="flex items-center justify-between gap-3">
						{#if customError}
							<span class="text-xs text-rose-300">{customError}</span>
						{:else}
							<span class="text-xs text-muted">Los comandos guardados aparecen arriba.</span>
						{/if}
						<Button size="sm" on:click={addCustomCommand}>Guardar</Button>
					</div>
				</div>
			</div>

			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<p class="text-sm font-semibold text-foreground">Perfiles de comandos</p>
				{#if profiles.length === 0}
					<p class="mt-3 text-xs text-muted">Crea un perfil para reutilizar comandos entre impresoras.</p>
				{:else}
					<div class="mt-3 space-y-3">
						{#each profiles as profile (profile.id)}
							<details class="rounded-lg border border-border/60 bg-surface px-3 py-2">
								<summary class="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-foreground">
									<span>{profile.name}</span>
									<div class="flex items-center gap-2">
										<span class="text-xs text-muted">{profile.commands.length} comandos</span>
										<label class="inline-flex items-center gap-1 text-xs text-muted">
											<input
												type="checkbox"
												class="h-3.5 w-3.5 rounded border-border/70 bg-surface text-accent focus:ring-0"
												checked={isProfileAssigned(profile.id)}
												on:change={(event) => toggleProfileForPrinter(profile.id, (event.currentTarget as HTMLInputElement).checked)}
											/>
											<span>Usar</span>
										</label>
										<Button variant="ghost" size="sm" on:click={() => deleteProfile(profile)}>Eliminar</Button>
									</div>
								</summary>
								<ul class="mt-2 space-y-1 text-xs text-muted">
									{#each profile.commands as command (command.id)}
										<li class="rounded bg-surface-muted/60 px-2 py-1">
											<span class="font-semibold text-foreground">{command.label}:</span>
											<code class="ml-2 text-[11px]">{command.script}</code>
										</li>
									{/each}
								</ul>
							</details>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-5">
			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm font-semibold text-foreground">Macros disponibles</p>
					{#if macros.length > 0}
						<span class="text-xs text-muted">{macros.length}</span>
					{/if}
				</div>
				{#if macrosLoading}
					<p class="mt-3 text-xs text-muted">Consultando Moonraker…</p>
				{:else if macrosError}
					<p class="mt-3 text-xs text-rose-300">{macrosError}</p>
				{:else if macros.length === 0}
					<p class="mt-3 text-xs text-muted">No se detectaron macros en Moonraker.</p>
				{:else}
					<div class="mt-4 space-y-3">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="flex flex-wrap items-center gap-2 text-xs text-muted">
								<span>Página {macrosPage} de {macrosTotalPages}</span>
								<span class="hidden sm:inline">·</span>
								<span>
									Mostrando
									{Math.min((macrosPage - 1) * macrosPageSize + 1, macros.length)}-
									{Math.min(macrosPage * macrosPageSize, macros.length)} de {macros.length}
								</span>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<div class="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.25em] text-muted">
									<span>Lote</span>
									{#each MACRO_PAGE_OPTIONS as option}
										<Button
											variant={macrosPageSize === option ? 'solid' : 'outline'}
											size="sm"
											class="px-2 py-0.5 text-[11px]"
											on:click={() => setMacrosPageSize(option)}
										>
											{option}
										</Button>
									{/each}
								</div>
								<div class="flex items-center gap-2">
									<Button variant="ghost" size="sm" on:click={() => goToMacrosPage(macrosPage - 1)} disabled={macrosPage <= 1}>Anterior</Button>
									<Button variant="ghost" size="sm" on:click={() => goToMacrosPage(macrosPage + 1)} disabled={macrosPage >= macrosTotalPages}>
										Siguiente
									</Button>
								</div>
							</div>
						</div>
						<ul class="grid gap-2 sm:grid-cols-2">
							{#each macrosPageItems as macro (macro.name)}
								<li class="flex flex-col gap-2 rounded border border-border/50 bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
									<span class="min-w-0 text-xs font-medium text-foreground wrap-break-word" title={macro.name}>{macro.name}</span>
									<div class="flex flex-wrap justify-end gap-1.5">
										<Button
											variant="outline"
											size="sm"
											class="px-2 py-0 text-[11px]"
											on:click={() => dispatchScript(macro.name, `macro:${macro.name}`)}
											disabled={isPending(`macro:${macro.name}`)}
										>
											Ejecutar
										</Button>
										<Button
											variant="ghost"
											size="sm"
											class="px-2 py-0 text-[11px]"
											on:click={() => addMacroAsCustomCommand(macro.name)}
										>
											Guardar
										</Button>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="text-sm font-semibold text-foreground">Consola</p>
						<div class="mt-1 flex items-center gap-2 text-[11px]">
							<span class={`h-2 w-2 rounded-full ${consoleIndicator.dot}`}></span>
							<span class={consoleIndicator.tone}>{consoleIndicator.text}</span>
							{#if consoleError}
								<span class="text-rose-300">· {consoleError}</span>
							{/if}
							{#if consoleHistoryError}
								<span class="text-amber-300">· {consoleHistoryError}</span>
							{/if}
						</div>
					</div>
					{#if consoleEntries.length > 0}
						<Button variant="ghost" size="sm" on:click={clearConsole}>Limpiar</Button>
					{/if}
				</div>
				{#if consoleEntries.length === 0}
					<p class="mt-3 text-xs text-muted">Aquí aparecerán los comandos enviados recientemente.</p>
				{:else}
						<ul class="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
						{#each consoleEntries as entry (entry.id)}
								<li class="rounded border border-border/60 bg-surface px-3 py-2 text-xs">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div class="flex min-w-0 items-center gap-2">
										<span class={`h-2 w-2 rounded-full ${entry.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
											<span class="font-semibold text-foreground">
											{entry.direction === 'outbound' ? 'Enviado' : 'Klipper'}
										</span>
											<span class="text-[10px] uppercase tracking-[0.25em] text-muted">{entry.origin}</span>
									</div>
									<span class="text-muted">{new Date(entry.at).toLocaleTimeString()}</span>
								</div>
								{#if entry.command}
										<pre class="mt-2 max-w-full overflow-x-auto rounded bg-surface-muted/80 px-2 py-1 text-[11px] text-foreground whitespace-pre-wrap wrap-break-word">{entry.command}</pre>
								{/if}
								{#if entry.direction === 'inbound' && entry.message}
										<pre class="mt-2 max-w-full overflow-x-auto rounded bg-surface-muted/60 px-2 py-1 text-[11px] text-muted whitespace-pre-wrap wrap-break-word">{entry.message}</pre>
								{:else if entry.message}
										<p class="mt-2 text-[11px] text-muted wrap-break-word">{entry.message}</p>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-xl border border-border/60 bg-surface-muted/60 p-4">
				<p class="text-sm font-semibold text-foreground">Perfiles de comandos</p>
				{#if profiles.length === 0}
					<p class="mt-3 text-xs text-muted">Crea un perfil para reutilizar comandos entre impresoras.</p>
				{:else}
					<div class="mt-3 space-y-3">
						{#each profiles as profile (profile.id)}
							<details class="rounded-lg border border-border/60 bg-surface px-3 py-2">
								<summary class="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-foreground">
									<span>{profile.name}</span>
									<div class="flex items-center gap-2">
										<span class="text-xs text-muted">{profile.commands.length} comandos</span>
										<label class="inline-flex items-center gap-1 text-xs text-muted">
											<input
												type="checkbox"
												class="h-3.5 w-3.5 rounded border-border/70 bg-surface text-accent focus:ring-0"
												checked={isProfileAssigned(profile.id)}
												on:change={(event) => toggleProfileForPrinter(profile.id, (event.currentTarget as HTMLInputElement).checked)}
											/>
											<span>Usar</span>
										</label>
										<Button variant="ghost" size="sm" on:click={() => deleteProfile(profile)}>Eliminar</Button>
									</div>
								</summary>
								<ul class="mt-2 space-y-1 text-xs text-muted">
									{#each profile.commands as command (command.id)}
										<li class="rounded bg-surface-muted/60 px-2 py-1">
											<span class="font-semibold text-foreground">{command.label}:</span>
											<code class="ml-2 text-[11px]">{command.script}</code>
										</li>
									{/each}
								</ul>
							</details>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<nav class="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 rounded-2xl border border-border/60 bg-surface/90 p-3 shadow-lg backdrop-blur md:flex">
	<ul class="flex flex-col gap-2">
		{#each floatingSidebarItems as item (item.id)}
			<li class="relative">
				<button
					type="button"
					class="group flex h-12 w-12 items-center justify-center rounded-xl border border-border/40 bg-surface-muted/80 text-muted transition hover:border-accent/60 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					on:mouseenter={() => setSidebarHover(item.id)}
					on:mouseleave={() => setSidebarHover(null)}
					on:focus={() => setSidebarHover(item.id)}
					on:blur={() => setSidebarHover(null)}
					aria-label={item.label}
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d={item.iconPath}></path>
					</svg>
					{#if sidebarHover === item.id}
						<span class="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border/40 bg-surface-muted/90 px-3 py-1 text-[11px] text-foreground shadow-xl">
							{item.label}
						</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</nav>

<Modal bind:open={createProfileOpen} title="Nuevo perfil de comandos" description="Agrupa comandos reutilizables y compártelos entre impresoras.">
	<form class="space-y-4" on:submit|preventDefault={createProfile}>
		<div class="space-y-1">
			<label class="text-xs font-semibold uppercase tracking-[0.3em] text-muted" for="profile-name">Nombre</label>
			<input
				id="profile-name"
				type="text"
				class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
				bind:value={profileName}
				placeholder="Ej. Calibración"
			/>
		</div>
		<div class="space-y-3">
			<p class="text-xs text-muted">Define los comandos que formarán parte del perfil.</p>
			{#each profileCommands as command, index (command.id)}
				<div class="rounded-lg border border-border/60 bg-surface-muted/60 p-3">
					<p class="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted">Comando #{index + 1}</p>
					<div class="mt-2 grid gap-2">
						<input
							class="w-full rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
							placeholder="Etiqueta"
							bind:value={command.label}
						/>
						<textarea
							class="h-20 w-full resize-none rounded-md border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
							placeholder="Comando GCode"
							bind:value={command.script}
						></textarea>
					</div>
					{#if profileCommands.length > 1}
						<div class="mt-2 flex justify-end">
							<Button variant="ghost" size="sm" on:click={() => removeProfileCommandRow(command.id)}>Eliminar</Button>
						</div>
					{/if}
				</div>
			{/each}
			<div class="flex justify-end">
				<Button type="button" variant="outline" size="sm" on:click={addProfileCommandRow}>Añadir comando</Button>
			</div>
		</div>
		{#if profileError}
			<p class="text-xs text-rose-300">{profileError}</p>
		{/if}
		<div class="flex justify-end gap-2 pt-2">
			<Button type="button" variant="ghost" size="sm" on:click={() => (createProfileOpen = false)}>Cancelar</Button>
			<Button type="submit" size="sm">Guardar perfil</Button>
		</div>
	</form>
</Modal>
