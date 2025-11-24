<script lang="ts" context="module">
  export type PopupPlacement = 'top' | 'bottom' | 'left' | 'right';
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  interface $$Slots {
    trigger: {
      open: boolean;
      toggle: () => void;
      close: (reason?: 'escape' | 'blur') => void;
    };
    default: {
      close: (reason?: 'escape' | 'blur') => void;
    };
  }

  export let open = false;
  export let placement: PopupPlacement = 'bottom';
  export let closeOnBlur = true;

  const dispatch = createEventDispatcher<{ open: void; close: void }>();

  let root: HTMLDivElement | null = null;
  let content: HTMLDivElement | null = null;

  const placementClasses: Record<PopupPlacement, string> = {
    top: 'bottom-full mb-3 left-0 sm:left-1/2 sm:-translate-x-1/2 origin-bottom',
    bottom: 'top-full mt-3 left-0 sm:left-1/2 sm:-translate-x-1/2 origin-top',
    left: 'right-full mr-3 top-1/2 -translate-y-1/2 origin-right',
    right: 'left-full ml-3 top-1/2 -translate-y-1/2 origin-left'
  };

  $: hasTriggerSlot = Boolean($$slots.trigger);

  function toggle() {
    open = !open;
    dispatch(open ? 'open' : 'close');
  }

  function close(reason?: 'escape' | 'blur') {
    if (!open) return;
    if (reason === 'blur' && !closeOnBlur) return;
    open = false;
    dispatch('close');
  }

  function handleDocumentPointer(event: PointerEvent) {
    if (!open || !root) return;
    const target = event.target as Node;
    if (!root.contains(target)) {
      close('blur');
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      close('escape');
    }
  }

  onMount(() => {
    document.addEventListener('pointerdown', handleDocumentPointer, true);
    document.addEventListener('keydown', handleEscape, true);
  });

  onDestroy(() => {
    document.removeEventListener('pointerdown', handleDocumentPointer, true);
    document.removeEventListener('keydown', handleEscape, true);
  });
</script>

<div class="popup-root relative inline-flex" bind:this={root}>
  {#if hasTriggerSlot}
    <slot name="trigger" {open} {toggle} {close}></slot>
  {:else}
    <button type="button" class="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm text-foreground transition hover:border-accent hover:text-accent" on:click={toggle}>
      {#if open}
        Ocultar
      {:else}
        Mostrar
      {/if}
    </button>
  {/if}

  {#if open}
    <div
      role="dialog"
      class={`popup-content absolute min-w-56 rounded-xl border border-border/70 bg-surface-muted/95 p-4 text-sm text-foreground shadow-[0_32px_80px_-56px_rgba(0,0,0,0.95)] backdrop-blur-md transition-transform duration-150 ease-out ${
        placementClasses[placement]
      }`}
      bind:this={content}
      aria-live="polite"
    >
      <slot {close} />
    </div>
  {/if}
</div>

<style>
  .popup-content {
    animation: popup-fade 120ms ease-out;
  }

  @keyframes popup-fade {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
