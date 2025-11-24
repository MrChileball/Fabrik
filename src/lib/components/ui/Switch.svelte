<script lang="ts" context="module">
  export type SwitchSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let checked = false;
  export let disabled = false;
  export let label: string | null = null;
  export let size: SwitchSize = 'md';
  export let id: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: { checked: boolean } }>();

  const trackClasses: Record<SwitchSize, string> = {
    sm: 'h-5 w-9',
    md: 'h-6 w-11',
    lg: 'h-7 w-14'
  };

  const thumbSizes: Record<SwitchSize, string> = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const translateActive: Record<SwitchSize, string> = {
    sm: 'translate-x-4',
    md: 'translate-x-5',
    lg: 'translate-x-7'
  };

  const translateIdle: Record<SwitchSize, string> = {
    sm: 'translate-x-1',
    md: 'translate-x-1',
    lg: 'translate-x-1.5'
  };

  const generatedId = `switch-${Math.random().toString(36).slice(2, 8)}`;
  $: resolvedId = id ?? generatedId;
  $: hasText = Boolean(label) || Boolean($$slots.default);
  $: thumbPosition = checked ? translateActive[size] : translateIdle[size];

  function handleChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    checked = target.checked;
    dispatch('change', { checked });
  }
</script>

<label
  class="switch-root inline-flex w-full max-w-full items-center gap-3 text-sm text-foreground"
  data-disabled={disabled}
  for={resolvedId}
>
  <span class="relative inline-flex items-center">
    <input
      class="sr-only"
      id={resolvedId}
      type="checkbox"
      bind:checked
      {disabled}
      on:change={handleChange}
      aria-checked={checked ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : 'false'}
    />
    <span
      class={`switch-track ${trackClasses[size]} rounded-full border border-border/80 bg-surface transition-colors duration-150 ${
        checked ? 'border-accent/60 bg-accent/20' : ''
      } ${disabled ? 'opacity-60' : 'hover:border-accent hover:bg-accent/10'}`}
      aria-hidden="true"
    >
      <span
        class={`switch-thumb ${thumbSizes[size]} ${thumbPosition} inline-block rounded-full bg-foreground shadow-[0_12px_24px_-18px_rgba(255,111,0,0.85)] transition-transform duration-150 ease-out ${
          checked ? 'bg-accent shadow-[0_14px_36px_-20px_rgba(255,111,0,0.9)]' : ''
        }`}
      ></span>
    </span>
  </span>

  {#if hasText}
    <span class={`switch-label select-none text-sm ${disabled ? 'text-muted/60' : 'text-foreground'}`}>
      <slot>{label}</slot>
    </span>
  {/if}
</label>

<style>
  .switch-root[data-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .switch-root:not([data-disabled='true']) {
    cursor: pointer;
  }
</style>
