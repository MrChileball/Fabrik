<script lang="ts">
  import PrinterOverview from '$lib/components/widgets/PrinterOverview.svelte';
  import PrinterStatus from '$lib/components/widgets/PrinterStatus.svelte';
  import PrinterCommandCenter from '$lib/components/widgets/PrinterCommandCenter.svelte';
  import Button from '$lib/components/base/Button.svelte';

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

  export let data: {
    printerId: string;
    baseUrl: string;
    name: string | null;
    node: string | null;
    overview: OverviewResponse;
    status: StatusResponse;
  };

  const printerName = data.name ?? 'Impresora';
  const nodeName = data.node ?? 'Nodo sin nombre';
  const printerId = data.printerId;

  const overviewInitial = data.overview.ok ? data.overview.data : null;
  const overviewError = data.overview.ok ? null : data.overview.error;
  const overviewBase = data.overview.ok ? data.overview.baseUrl : data.baseUrl;

  const statusInitial = data.status.ok ? data.status.data : null;
  const statusError = data.status.ok ? null : data.status.error;
  const statusBase = data.status.ok ? data.status.baseUrl : data.baseUrl;

  let autoRefreshOverview = true;
</script>

<section class="mx-auto flex max-w-5xl flex-col gap-6 p-5 sm:p-8">
  <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-muted">{nodeName}</p>
      <h1 class="text-3xl font-semibold text-foreground sm:text-4xl">{printerName}</h1>
      <p class="text-sm text-muted">Base Moonraker · {data.baseUrl}</p>
    </div>
    <a href="/" class="inline-flex">
      <Button variant="outline" size="sm">Volver al listado</Button>
    </a>
  </header>

  <PrinterOverview
    baseUrl={data.baseUrl}
    deviceName={printerName}
    bind:autoRefresh={autoRefreshOverview}
    initialOverview={overviewInitial}
    initialError={overviewError}
    initialBaseUrl={overviewBase}
  />

  <PrinterStatus
    baseUrl={data.baseUrl}
    initialInfo={statusInitial}
    initialError={statusError}
    initialBaseUrl={statusBase}
  />

  <PrinterCommandCenter baseUrl={data.baseUrl} printerId={printerId} printerName={printerName} />
</section>
