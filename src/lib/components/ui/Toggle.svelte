<script lang="ts" context="module">
  export type ToggleSize = 'sm' | 'md';
</script>

<script lang="ts">
  export let checked = false;
  export let disabled = false;
  export let size: ToggleSize = 'md';
  export let label: string | null = null;
  export let id: string | undefined = undefined;

  const trackBySize: Record<ToggleSize, string> = {
    sm: 'h-4 w-8',
    md: 'h-5 w-10'
  };

  const thumbBySize: Record<ToggleSize, string> = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4'
  };

  const translateActive: Record<ToggleSize, string> = {
    sm: 'translate-x-4',
    md: 'translate-x-5'
  };

  const translateIdle: Record<ToggleSize, string> = {
    sm: 'translate-x-1',
    md: 'translate-x-1'
  };

  const generatedId = `toggle-${Math.random().toString(36).slice(2, 8)}`;
  $: resolvedId = id ?? generatedId;
  $: thumbPosition = checked ? translateActive[size] : translateIdle[size];
</script>

<label class="inline-flex items-center gap-3 text-sm" data-disabled={disabled} for={resolvedId}>
  <span class="relative inline-flex items-center">
    <input
      id={resolvedId}
      class="sr-only"
      type="checkbox"
      bind:checked
      {disabled}
      aria-checked={checked ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : 'false'}
    />
    <span
      class={`inline-flex items-center rounded-full border border-border/60 bg-surface transition-colors duration-150 ${
        trackBySize[size]
      } ${checked ? 'border-accent bg-accent/20' : ''} ${disabled ? 'opacity-60' : 'hover:border-accent'}`}
      aria-hidden="true"
    >
      <span
        class={`rounded-full bg-foreground transition-transform duration-150 ease-out ${thumbBySize[size]} ${thumbPosition} ${
          checked ? 'bg-accent' : ''
        }`}
      ></span>
    </span>
  </span>

  {#if label}
    <span class={`select-none ${disabled ? 'text-muted/70' : 'text-foreground'}`}>
      {label}
    </span>
  {/if}

  <slot />
</label>

<style>
  label[data-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.7;
  }

  label:not([data-disabled='true']) {
    cursor: pointer;
  }
</style>
