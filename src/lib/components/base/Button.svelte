<script lang="ts" context="module">
  export type ButtonVariant = 'solid' | 'outline' | 'ghost';
  export type ButtonSize = 'sm' | 'md';
</script>

<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  export let variant: ButtonVariant = 'solid';
  export let size: ButtonSize = 'md';
  export let disabled = false;
  export let type: HTMLButtonAttributes['type'] = 'button';

  const base =
    'inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

  const variants: Record<ButtonVariant, string> = {
    solid: 'border-transparent bg-accent text-accent-contrast hover:bg-accent-strong',
    outline: 'border-border/70 bg-transparent text-foreground hover:border-accent hover:text-accent',
    ghost: 'border-transparent bg-transparent text-muted hover:text-accent'
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1 text-[11px]',
    md: 'px-3.5 py-1.5 text-sm'
  };

  $: classes = `${base} ${variants[variant]} ${sizes[size]}`;
</script>

<button {type} class={classes} disabled={disabled} on:click {...$$restProps}>
  <slot />
</button>
