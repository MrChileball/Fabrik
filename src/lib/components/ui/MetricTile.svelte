<script lang="ts">
  export let label: string;
  export let value: string;
  export let hint: string | null = null;
  export let align: 'left' | 'center' = 'left';
</script>

<div class={`metric-tile rounded-xl border border-border/60 bg-surface-muted/60 p-4 ${align === 'center' ? 'text-center' : 'text-left'}`}>
  <p class="text-[0.7rem] uppercase tracking-[0.3em] text-muted">{label}</p>
  <p class="mt-2 text-3xl font-semibold text-foreground tabular-nums sm:text-4xl">{value}</p>
  {#if hint}
    <p class="mt-2 text-sm text-muted">{hint}</p>
  {/if}
  <slot name="footer" />
</div>
