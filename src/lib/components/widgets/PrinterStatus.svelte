<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../base/Button.svelte';

  export let baseUrl = 'http://192.168.1.17';
  export let initialInfo: PrinterInfo | null = null;
  export let initialError: string | null = null;
  export let initialBaseUrl: string | null = null;

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

  type ApiSuccess = {
    ok: true;
    data: PrinterInfo;
    baseUrl: string;
  };

  type ApiFailure = {
    ok: false;
    error: string;
  };

  type ApiResponse = ApiSuccess | ApiFailure;

  let info: PrinterInfo | null = initialInfo;
  let state: PrinterState = info?.state ?? null;
  let printer: PrinterMeta = info?.printer ?? null;
  let error: string | null = initialError;
  let loading = false;
  let effectiveBase = initialBaseUrl ?? baseUrl;

  async function fetchInfo() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({ baseUrl });
      const response = await fetch(`/api/printer-info?${params.toString()}`);

      if (!response.ok) {
        const fallback = `Moonraker respondió ${response.status}`;
        const payload = (await response.json().catch(() => null)) as ApiResponse | null;
        throw new Error(payload && !payload.ok ? payload.error : fallback);
      }

      const payload = (await response.json()) as ApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      info = payload.data;
      effectiveBase = payload.baseUrl ?? baseUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      error = `No se pudo cargar el estado: ${message}`;
      info = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (!info && !error) {
      fetchInfo();
    }
  });

  $: state = info?.state ?? null;
  $: printer = info?.printer ?? null;
</script>

<section class="rounded-xl border border-border/60 bg-surface/80 p-6 shadow-sm">
  <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-foreground">Estado general</h2>
      <p class="text-sm text-muted">Fuente: {effectiveBase}/printer/info</p>
    </div>
    <Button size="sm" variant="outline" on:click={fetchInfo} disabled={loading}>
      {loading ? 'Actualizando…' : 'Actualizar'}
    </Button>
  </header>

  {#if loading}
    <p class="mt-4 text-sm text-muted">Consultando Moonraker…</p>
  {:else if error}
    <p class="mt-4 rounded-md border border-border/60 bg-surface-muted/60 p-4 text-sm text-danger">{error}</p>
  {:else if info}
    <div class="mt-6 space-y-4 text-sm">
      {#if state}
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-border/60 bg-surface-muted/60 p-4">
            <p class="text-xs uppercase tracking-wide text-muted">Estado</p>
            <p class="mt-1 text-base font-semibold text-foreground">{state.text ?? 'Desconocido'}</p>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface-muted/60 p-4">
            <p class="text-xs uppercase tracking-wide text-muted">Mensaje</p>
            <p class="mt-1 text-base text-foreground">{state.message ?? '—'}</p>
          </div>
        </div>
      {/if}

      {#if printer}
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-border/60 bg-surface-muted/60 p-4">
            <p class="text-xs uppercase tracking-wide text-muted">Firmware</p>
            <p class="mt-1 text-base font-semibold text-foreground">{printer.firmware_version ?? 'N/D'}</p>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface-muted/60 p-4">
            <p class="text-xs uppercase tracking-wide text-muted">Modelo</p>
            <p class="mt-1 text-base text-foreground">{printer.model ?? 'N/D'}</p>
          </div>
        </div>
      {/if}

      <details class="rounded-lg border border-border/60 bg-surface-muted/50 p-4 text-xs text-muted">
        <summary class="cursor-pointer text-sm font-semibold text-foreground">Ver JSON completo</summary>
        <pre class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface px-3 py-2 text-[11px] text-muted">{JSON.stringify(info, null, 2)}</pre>
      </details>
    </div>
  {:else}
    <p class="mt-4 text-sm text-muted">No se recibió información de la impresora.</p>
  {/if}
</section>
