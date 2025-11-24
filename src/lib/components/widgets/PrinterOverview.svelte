<script lang="ts">
  // PrinterOverview centraliza métricas clave de Moonraker y ofrece controles rápidos al operador.
  import { onDestroy, onMount } from 'svelte';
  import Button from '../base/Button.svelte';
  import MetricTile from '../base/MetricTile.svelte';
  import ProgressBar from '../base/ProgressBar.svelte';
  import Toggle from '../base/Toggle.svelte';

  // --- Tipos de datos devueltos por los proxys de Moonraker ---
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

  type OverviewPayload = {
    bed: HeaterSnapshot;
    hotend: HeaterSnapshot;
    motion: MotionSnapshot;
    print: PrintSnapshot;
  };

  type ApiSuccess = { ok: true; data: OverviewPayload; baseUrl: string };
  type ApiError = { ok: false; error: string };
  type ApiResponse = ApiSuccess | ApiError;

  // --- Parámetros del componente ---
  export let baseUrl = 'http://192.168.1.17';
  export let deviceName: string | null = null;
  export let autoRefresh = false;
  export let refreshMs = 1_500;
  export let initialOverview: OverviewPayload | null = null;
  export let initialError: string | null = null;
  export let initialBaseUrl: string | null = null;

  // --- Estado local derivado del payload inicial ---
  let loading = false;
  let error: string | null = initialError;
  let overview: OverviewPayload | null = initialOverview;
  let effectiveBase = initialBaseUrl ?? baseUrl;

  let intervalId: ReturnType<typeof setInterval> | undefined;
  let controlPending:
    | 'pause'
    | 'home_xy'
    | 'home_xyz'
    | 'bed_mesh_calibrate'
    | 'screws_tilt_calculate'
    | 'set_bed_temperature'
    | 'set_hotend_temperature'
    | null = null;
  let controlError: string | null = null;
  let controlMessage: string | null = null;
  let bedTargetInput = '';
  let hotendTargetInput = '';
  let bedInputFocused = false;
  let hotendInputFocused = false;
  let bedInputDirty = false;
  let hotendInputDirty = false;
  let stateDisplay: StateDisplay = { label: 'Desconocido', variant: 'unknown' };

  type StateVariant = 'printing' | 'idle' | 'paused' | 'complete' | 'error' | 'unknown';

  type StateDisplay = {
    label: string;
    variant: StateVariant;
  };

  // --- Ciclo de datos: consulta periódica a Moonraker ---
  async function fetchOverview() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({ baseUrl });
      const response = await fetch(`/api/printer-overview?${params.toString()}`);

      if (!response.ok) {
        const fallback = `Moonraker respondió ${response.status}`;
        const payload = (await response.json().catch(() => null)) as ApiResponse | null;
        throw new Error(payload && !payload.ok ? payload.error : fallback);
      }

      const payload = (await response.json()) as ApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      overview = {
        ...payload.data,
        motion: payload.data.motion ?? { speed: null }
      };
      syncTargetInputs();
      effectiveBase = payload.baseUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      error = message;
      overview = null;
    } finally {
      loading = false;
    }
  }

  function startAutoRefresh() {
    if (intervalId) return;
    intervalId = setInterval(() => {
      fetchOverview();
    }, refreshMs);
  }

  function stopAutoRefresh() {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = undefined;
  }

  onMount(() => {
    if (!overview && !error) {
      fetchOverview();
    }

    if (autoRefresh) {
      startAutoRefresh();
    }
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  $: if (autoRefresh) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }

  // --- Utilidades de formato para la UI ---
  const formatTemp = (value: number | null) =>
    value === null || Number.isNaN(value) ? '—' : `${value.toFixed(1)}°C`;

  const formatDuration = (value: number | null) => {
    if (value === null || Number.isNaN(value)) {
      return '—';
    }

    const seconds = Math.max(0, Math.floor(value));

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (hours === 0 && minutes === 0 && secs > 0) {
      parts.push(`${secs}s`);
    }

    return parts.length > 0 ? parts.join(' ') : '0s';
  };

  const formatSpeed = (value: number | null) =>
    value === null || Number.isNaN(value) ? '—' : `${value.toFixed(1)} mm/s`;

  // Determina etiqueta y color del estado reportado por Moonraker.
  const resolveStateDisplay = (raw: string | null): StateDisplay => {
    if (!raw) {
      return { label: 'Desconocido', variant: 'unknown' };
    }

    const normalized = raw.toLowerCase();

    if (normalized.includes('print')) {
      return { label: 'Imprimiendo', variant: 'printing' };
    }

    if (normalized.includes('complete') || normalized.includes('done') || normalized.includes('finish')) {
      return { label: 'Completado', variant: 'complete' };
    }

    if (normalized.includes('pause')) {
      return { label: 'Pausado', variant: 'paused' };
    }

    if (normalized.includes('standby') || normalized.includes('idle') || normalized.includes('ready')) {
      return { label: 'Standby', variant: 'idle' };
    }

    if (normalized.includes('error') || normalized.includes('fault') || normalized.includes('halt')) {
      return { label: 'Error', variant: 'error' };
    }

    return { label: raw, variant: 'unknown' };
  };

  // Mantiene los campos de temperatura sincronizados con la lectura actual, respetando las ediciones en curso.
  function syncTargetInputs() {
    if (!overview) return;
    if (!bedInputFocused && !bedInputDirty) {
      bedTargetInput = overview.bed.target !== null && overview.bed.target !== undefined ? `${overview.bed.target.toFixed(1)}` : '';
    }
    if (!hotendInputFocused && !hotendInputDirty) {
      hotendTargetInput = overview.hotend.target !== null && overview.hotend.target !== undefined ? `${overview.hotend.target.toFixed(1)}` : '';
    }
  }

  $: syncTargetInputs();
  $: stateDisplay = resolveStateDisplay(overview?.print.state ?? null);

  // Envía acciones Moonraker (pausa, homing, macros, setpoints) a través del proxy del servidor.
  async function sendControl(
    action:
      | 'pause'
      | 'home_xy'
      | 'home_xyz'
      | 'bed_mesh_calibrate'
      | 'screws_tilt_calculate'
      | 'set_bed_temperature'
      | 'set_hotend_temperature',
    value?: number
  ) {
    controlPending = action;
    controlError = null;
    controlMessage = null;

    try {
      console.log('[PrinterOverview] dispatching control action', {
        action,
        baseUrl: effectiveBase ?? baseUrl,
        value
      });

      const response = await fetch('/api/printer-control', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, baseUrl: effectiveBase ?? baseUrl, value })
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; message?: string; status?: number; moonraker?: unknown }
        | { ok: false; error: string }
        | null;

      if (!response.ok) {
        const fallback = `Moonraker respondió ${response.status}`;
        const message = payload && !payload.ok ? payload.error : fallback;
        console.warn('[PrinterOverview] control action failed', {
          action,
          status: response.status,
          payload
        });
        throw new Error(message);
      }

      if (!payload || !payload.ok) {
        console.warn('[PrinterOverview] control action received error payload', {
          action,
          payload
        });
        throw new Error(payload?.error ?? 'Acción desconocida');
      }

      const statusSuffix = payload.status ? ` (HTTP ${payload.status})` : '';
      let details = '';

      if (payload.moonraker && typeof payload.moonraker === 'object') {
        details = ` · ${JSON.stringify(payload.moonraker)}`;
      } else if (payload.moonraker) {
        details = ` · ${payload.moonraker}`;
      }

      controlMessage = `${payload.message ?? 'Comando enviado'}${statusSuffix}${details}`;
      console.info('[PrinterOverview] control action acknowledged', {
        action,
        payload
      });

      const heaterUpdate = action === 'set_bed_temperature' || action === 'set_hotend_temperature';

      if (heaterUpdate && overview && typeof value === 'number') {
        const currentOverview = overview;

        if (action === 'set_bed_temperature') {
          bedInputDirty = false;
          overview = {
            ...currentOverview,
            bed: {
              ...currentOverview.bed,
              target: value
            }
          };
        }

        if (action === 'set_hotend_temperature') {
          hotendInputDirty = false;
          overview = {
            ...currentOverview,
            hotend: {
              ...currentOverview.hotend,
              target: value
            }
          };
        }

        syncTargetInputs();
      }

      if (heaterUpdate) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      await fetchOverview();
    } catch (err) {
      controlError = err instanceof Error ? err.message : 'No se pudo enviar el comando';
      console.error('[PrinterOverview] control action threw error', {
        action,
        error: controlError
      });
    } finally {
      controlPending = null;
    }
  }

  function parseTarget(value: string) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  async function applyBedTarget() {
    const numeric = parseTarget(bedTargetInput);
    if (numeric === null) {
      controlError = 'Temperatura de cama inválida';
      controlMessage = null;
      return;
    }
    await sendControl('set_bed_temperature', Number(numeric.toFixed(1)));
  }

  async function applyHotendTarget() {
    const numeric = parseTarget(hotendTargetInput);
    if (numeric === null) {
      controlError = 'Temperatura de hotend inválida';
      controlMessage = null;
      return;
    }
    await sendControl('set_hotend_temperature', Number(numeric.toFixed(1)));
  }
</script>

<section class="rounded-xl border border-border/60 bg-surface/80 p-5 shadow-sm">
  <!-- Cabecera con identidad del equipo y estado en vivo -->
  <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-cube-3d-sphere"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 17.6l-2 -1.1v-2.5" /><path d="M4 10v-2.5l2 -1.1" /><path d="M10 4.1l2 -1.1l2 1.1" /><path d="M18 6.4l2 1.1v2.5" /><path d="M20 14v2.5l-2 1.12" /><path d="M14 19.9l-2 1.1l-2 -1.1" /><path d="M12 12l2 -1.1" /><path d="M18 8.6l2 -1.1" /><path d="M12 12l0 2.5" /><path d="M12 18.5l0 2.5" /><path d="M12 12l-2 -1.12" /><path d="M6 8.6l-2 -1.1" /></svg>
        <h2 class="text-lg font-semibold text-foreground">{deviceName ?? 'Visión general'}</h2>
      </div>
      <p class="text-sm text-muted">Consultando {effectiveBase}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <div class="inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface-muted/50 px-3 py-1 text-xs font-medium">
        <span
          class="h-2.5 w-2.5 rounded-full"
          class:bg-emerald-500={stateDisplay.variant === 'printing'}
          class:bg-sky-500={stateDisplay.variant === 'idle'}
          class:bg-amber-500={stateDisplay.variant === 'paused'}
          class:bg-lime-500={stateDisplay.variant === 'complete'}
          class:bg-rose-500={stateDisplay.variant === 'error'}
          class:bg-slate-500={stateDisplay.variant === 'unknown'}
        ></span>
        <span
          class="whitespace-nowrap"
          class:text-emerald-300={stateDisplay.variant === 'printing'}
          class:text-sky-300={stateDisplay.variant === 'idle'}
          class:text-amber-300={stateDisplay.variant === 'paused'}
          class:text-lime-300={stateDisplay.variant === 'complete'}
          class:text-rose-300={stateDisplay.variant === 'error'}
          class:text-muted={stateDisplay.variant === 'unknown'}
        >{stateDisplay.label}</span>
      </div>
      <Toggle bind:checked={autoRefresh} label="Auto refrescar" />
      <Button variant="outline" size="sm" on:click={fetchOverview} disabled={loading}>
        {loading ? 'Actualizando…' : 'Refrescar'}
      </Button>
    </div>
  </header>

  {#if error}
    <p class="mt-4 rounded-md border border-border/60 bg-surface-muted/60 p-4 text-sm text-danger">
      {error}. Verifica que Moonraker sea accesible.
    </p>
  {:else if !overview && loading}
    <p class="mt-4 text-sm text-muted">Cargando información de la impresora…</p>
  {:else if overview}
    <!-- Resumen de métricas principales -->
    <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricTile
        label="Temperatura cama"
        value={formatTemp(overview.bed.temperature)}
        hint={`Objetivo ${formatTemp(overview.bed.target)}`}
        align="center"
      >
        <svelte:fragment slot="footer">
          <div class="mt-2 flex items-center justify-center gap-2 text-xs text-muted">
            <input
              class="w-20 rounded-md border border-border/60 bg-surface px-2 py-1 text-center text-xs text-foreground focus:border-accent focus:outline-none"
              type="number"
              step="0.1"
              min="0"
              bind:value={bedTargetInput}
              on:input={() => {
                bedInputDirty = true;
              }}
              on:focus={() => (bedInputFocused = true)}
              on:blur={() => {
                bedInputFocused = false;
                if (!bedInputDirty) {
                  syncTargetInputs();
                }
              }}
            />
            <button
              class="rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              on:click|preventDefault={applyBedTarget}
              disabled={controlPending !== null}
            >
              {controlPending === 'set_bed_temperature' ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </svelte:fragment>
      </MetricTile>
      <MetricTile
        label="Temperatura hotend"
        value={formatTemp(overview.hotend.temperature)}
        hint={`Objetivo ${formatTemp(overview.hotend.target)}`}
        align="center"
      >
        <svelte:fragment slot="footer">
          <div class="mt-2 flex items-center justify-center gap-2 text-xs text-muted">
            <input
              class="w-20 rounded-md border border-border/60 bg-surface px-2 py-1 text-center text-xs text-foreground focus:border-accent focus:outline-none"
              type="number"
              step="0.1"
              min="0"
              bind:value={hotendTargetInput}
              on:input={() => {
                hotendInputDirty = true;
              }}
              on:focus={() => (hotendInputFocused = true)}
              on:blur={() => {
                hotendInputFocused = false;
                if (!hotendInputDirty) {
                  syncTargetInputs();
                }
              }}
            />
            <button
              class="rounded-md border border-border/60 px-2 py-1 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              on:click|preventDefault={applyHotendTarget}
              disabled={controlPending !== null}
            >
              {controlPending === 'set_hotend_temperature' ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
        </svelte:fragment>
      </MetricTile>
      <MetricTile
        label="Velocidad"
        value={formatSpeed(overview.motion.speed)}
        hint="Medida actual del cabezal"
        align="center"
      />
      <div aria-hidden="true" class="hidden rounded-xl border border-transparent p-4 lg:block"></div>
    </div>

    <!-- Resumen de progreso y tiempos estimados -->
    <div class="mt-5 space-y-3">
      <ProgressBar value={overview.print.progress ?? 0} label="Progreso de la impresión" />

      <div class="grid gap-2 text-xs text-muted sm:grid-cols-2">
        <div class="flex items-center justify-between rounded-lg border border-border/50 bg-surface-muted/40 px-3 py-2">
          <span class="uppercase tracking-[0.2em]">Transcurrido</span>
          <span class="text-sm font-semibold text-foreground">{formatDuration(overview.print.elapsedSeconds)}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border border-border/50 bg-surface-muted/40 px-3 py-2">
          <span class="uppercase tracking-[0.2em]">Total estimado</span>
          <span class="text-sm font-semibold text-foreground">{formatDuration(overview.print.totalSeconds)}</span>
        </div>
        {#if overview.print.elapsedSeconds !== null && overview.print.totalSeconds !== null}
          <div class="flex items-center justify-between rounded-lg border border-border/50 bg-surface-muted/40 px-3 py-2 sm:col-span-2">
            <span class="uppercase tracking-[0.2em]">Restante</span>
            <span class="text-sm font-semibold text-foreground">
              {formatDuration(Math.max(0, overview.print.totalSeconds - overview.print.elapsedSeconds))}
            </span>
          </div>
        {/if}
      </div>

      {#if overview.print.message}
        <p class="text-xs text-muted">{overview.print.message}</p>
      {/if}
    </div>

    <!-- Acciones directas: pausa, homing y macros de calibración -->
    <div class="mt-5 space-y-3">
      <div class="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          on:click={() => sendControl('pause')}
          disabled={controlPending !== null}
        >
          {controlPending === 'pause' ? 'Pausando…' : 'Pausar impresión'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          on:click={() => sendControl('home_xy')}
          disabled={controlPending !== null}
        >
          {controlPending === 'home_xy' ? 'Homing XY…' : 'Home XY'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          on:click={() => sendControl('home_xyz')}
          disabled={controlPending !== null}
        >
          {controlPending === 'home_xyz' ? 'Homing XYZ…' : 'Home XYZ'}
        </Button>
      </div>

      <div class="rounded-xl border border-border/50 bg-surface-muted/40 p-4">
        <p class="text-sm font-semibold text-foreground">Calibración rápida</p>
        <p class="text-xs text-muted">Ejecución de macros habituales directamente desde el panel.</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            on:click={() => sendControl('bed_mesh_calibrate')}
            disabled={controlPending !== null}
          >
            {controlPending === 'bed_mesh_calibrate' ? 'Nivelando…' : 'Nivelar cama'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            on:click={() => sendControl('screws_tilt_calculate')}
            disabled={controlPending !== null}
          >
            {controlPending === 'screws_tilt_calculate' ? 'Calculando…' : 'Calcular giro tuercas'}
          </Button>
        </div>
      </div>

      {#if controlError}
        <p class="text-xs text-danger">{controlError}</p>
      {:else if controlMessage}
        <p class="text-xs text-accent">{controlMessage}</p>
      {/if}
    </div>
  {:else}
    <p class="mt-4 text-sm text-muted">Sin datos disponibles todavía.</p>
  {/if}
</section>
