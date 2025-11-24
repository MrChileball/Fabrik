<script lang="ts" context="module">
  export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  interface $$Slots {
    header: Record<string, never>;
    default: Record<string, never>;
    footer: {
      close: (reason: 'backdrop' | 'escape' | 'action') => void;
    };
  }

  export let open = false;
  export let title: string | null = null;
  export let description: string | null = null;
  export let size: ModalSize = 'md';
  export let closeOnBackdrop = true;
  export let closeOnEscape = true;
  export let labelledBy: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: { reason: 'backdrop' | 'escape' | 'action' }; open: void }>();

  const panelSizes: Record<ModalSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl'
  };

  const generatedId = `modal-${Math.random().toString(36).slice(2, 8)}`;
  $: titleId = title ? `${generatedId}-title` : undefined;
  $: descriptionId = description ? `${generatedId}-description` : undefined;
  $: effectiveLabel = labelledBy ?? titleId;
  $: effectiveDescription = description ? descriptionId : undefined;

  let previousOverflow: string | null = null;
  let wasOpen = false;
  $: if (typeof document !== 'undefined') {
    if (open) {
      if (previousOverflow === null) {
        previousOverflow = document.body.style.overflow;
      }
      document.body.style.overflow = 'hidden';
      if (!wasOpen) {
        wasOpen = true;
        dispatch('open');
      }
    } else {
      if (previousOverflow !== null) {
        document.body.style.overflow = previousOverflow;
        previousOverflow = null;
      }
      if (wasOpen) {
        wasOpen = false;
      }
    }
  }

  onDestroy(() => {
    if (previousOverflow !== null && typeof document !== 'undefined') {
      document.body.style.overflow = previousOverflow;
    }
  });

  $: hasHeaderSlot = Boolean(title) || Boolean($$slots.header);
  $: hasFooterSlot = Boolean($$slots.footer);
  $: hasBodySlot = Boolean($$slots.default) || Boolean(description);

  function requestClose(reason: 'backdrop' | 'escape' | 'action') {
    if (!open) return;
    open = false;
    dispatch('close', { reason });
  }

  function handleBackdropClick() {
    if (!closeOnBackdrop) return;
    requestClose('backdrop');
  }

  function handleEscape(event: KeyboardEvent) {
    if (!open || !closeOnEscape) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose('escape');
    }
  }
</script>

<svelte:window on:keydown={handleEscape} />

{#if open}
  <div class="modal-root fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-8" role="presentation">
    <button
      type="button"
      class="modal-backdrop absolute inset-0 bg-[rgba(15,17,23,0.74)] backdrop-blur-sm"
      on:click={handleBackdropClick}
      aria-label="Cerrar"
    ></button>
    <div
      class={`modal-panel relative z-10 w-full ${panelSizes[size]} rounded-2xl border border-border/70 bg-surface/95 shadow-[0_48px_120px_-60px_rgba(0,0,0,0.95)] backdrop-blur-md transition-transform duration-200`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={effectiveLabel}
      aria-describedby={effectiveDescription}
    >
      {#if hasHeaderSlot}
        <header class="flex flex-col gap-2 border-b border-border/70 px-6 py-5">
          <slot name="header">
            {#if title}
              <h2 id={titleId} class="text-lg font-semibold text-foreground">{title}</h2>
            {/if}
            {#if description}
              <p id={descriptionId} class="text-sm text-muted">{description}</p>
            {/if}
          </slot>
        </header>
      {/if}

      {#if hasBodySlot}
        <div class="modal-body max-h-[70vh] overflow-y-auto px-6 py-6 text-sm text-foreground/90">
          <slot>
            {#if description && !hasHeaderSlot}
              <p id={descriptionId} class="text-sm text-muted">{description}</p>
            {/if}
          </slot>
        </div>
      {/if}

      {#if hasFooterSlot}
        <footer class="flex flex-col gap-3 border-t border-border/70 bg-surface-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <slot name="footer" close={requestClose}></slot>
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-root {
    animation: modal-fade 150ms ease-out;
  }

  .modal-panel {
    animation: modal-pop 160ms ease-out;
  }

  @keyframes modal-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes modal-pop {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
