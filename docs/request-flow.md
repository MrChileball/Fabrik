# Request Flow

This document explains how UI interactions travel through the system until they reach Moonraker.

## High-Level Sequence
1. A Svelte component (for example `PrinterCommandCenter.svelte`) triggers an action using `fetch('/api/...')`.
2. SvelteKit routes the request to the matching file under `src/routes/api/`.
3. The endpoint validates the payload and either calls Moonraker or mutates the local store.
4. The endpoint returns a JSON object shaped as `{ ok: boolean, data?: T, error?: string }`.
5. The frontend inspects the envelope, updates UI state, and optionally schedules a registry sync.

## Registry Updates
- `POST /api/printer-registry`: accepts actions like `add-printer`, `remove-printer`, `remove-node`, `sync-states`.
- After a mutation, the endpoint reads the latest snapshot from the store and returns it to keep clients in sync.
- UI components merge the snapshot into their local state so the dashboard stays consistent without a full reload.

## Moonraker Proxies
- `/api/printer-overview`, `/api/printer-info`, `/api/printer-control`, and `/api/printer-console` translate request parameters into Moonraker calls.
- Each proxy builds the target URL using the printer base URL stored in the registry.
- Responses are streamed back to the browser unchanged whenever possible; errors are normalized with an explanatory message.

## Error Propagation
- Network or validation failures always produce `{ ok: false, error: 'message' }`.
- Components show inline toasts or banners so operators know when Moonraker rejected a command.
- The registry synchronization step is skipped when a mutation fails, preventing partial state updates.

## Adding New Flows
1. Define the new action in the frontend and decide whether it requires Moonraker or local persistence.
2. Create or extend the corresponding API endpoint.
3. Follow the same response envelope so existing helper functions can reuse it.
4. Update the UI to handle success and failure consistently.
