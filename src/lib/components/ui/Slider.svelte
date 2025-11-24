<script lang="ts" context="module">
  export type SliderSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let label: string | null = null;
  export let size: SliderSize = 'md';
  export let showValue = true;
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: { value: number } }>();

  $: ratio = max > min ? (value - min) / (max - min) : 0;
  $: filledPercent = `${Math.min(Math.max(ratio, 0), 1) * 100}%`;

  const sizeClass: Record<SliderSize, string> = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2.5'
  };

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = Number(target.value);
    dispatch('change', { value });
  }
</script>

<div class="slider-wrapper space-y-2" data-disabled={disabled}>
  {#if label}
    <div class="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
      <span>{label}</span>
      {#if showValue}
        <span class="tabular-nums text-muted/80">{value}</span>
      {/if}
    </div>
  {/if}
  <div class="slider-track {sizeClass[size]}">
    <div class="slider-fill" style={`width: ${filledPercent};`} aria-hidden="true"></div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      bind:value
      {disabled}
      on:input={handleInput}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label ?? undefined}
    />
  </div>
</div>

<style>
  .slider-wrapper[data-disabled="true"] {
    opacity: 0.55;
  }

  .slider-track {
    position: relative;
    width: 100%;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-border) 70%, transparent);
    overflow: hidden;
  }

  .slider-fill {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    transition: width 120ms ease-out;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    position: absolute;
    inset: 0;
    margin: 0;
    background: transparent;
  }

  input[type='range']:focus-visible {
    outline: none;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 9999px;
    background: var(--color-surface);
    border: 2px solid color-mix(in srgb, var(--color-accent) 80%, transparent);
    box-shadow: 0 4px 16px -6px rgba(255, 111, 0, 0.75);
    cursor: pointer;
    transition: transform 120ms ease-out, border-color 120ms ease-out;
  }

  input[type='range']::-webkit-slider-thumb:hover {
    transform: scale(1.08);
    border-color: var(--color-accent-strong);
  }

  input[type='range']::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 9999px;
    background: var(--color-surface);
    border: 2px solid color-mix(in srgb, var(--color-accent) 80%, transparent);
    box-shadow: 0 4px 16px -6px rgba(255, 111, 0, 0.75);
    cursor: pointer;
    transition: transform 120ms ease-out, border-color 120ms ease-out;
  }

  input[type='range']::-moz-range-thumb:hover {
    transform: scale(1.08);
    border-color: var(--color-accent-strong);
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 100%;
  }

  input[type='range']::-moz-range-track {
    height: 100%;
  }
</style>
