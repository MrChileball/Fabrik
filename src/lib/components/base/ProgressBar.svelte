<script lang="ts">
  export let value = 0;
  export let label: string | null = null;

  $: clamped = Math.min(Math.max(value, 0), 100);
</script>

<div class="space-y-2">
  {#if label}
    <div class="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
      <span>{label}</span>
      <span class="tabular-nums text-muted/80">{clamped.toFixed(0)}%</span>
    </div>
  {/if}
  <div class="relative h-2 w-full overflow-hidden rounded-full bg-border/40">
    <div
      class="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-200 ease-out"
      style={`width: ${clamped}%`}
      aria-hidden="true"
    ></div>
  </div>
</div>
