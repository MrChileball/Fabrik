# Backend Overview

This project uses the SvelteKit server runtime to provide a thin backend layer that hides Moonraker and offers local persistence. The backend lives entirely inside the `src/routes/api/` and `src/lib/server/` folders.

## Goals
- Centralize every Moonraker request behind local endpoints to avoid CORS issues.
- Persist printer and node metadata so the dashboard can recover state after restarts.
- Provide a cache that smooths bursty traffic from the UI without hammering Moonraker.

## Key Modules
- `src/lib/server/printerStore.ts`: JSON-backed store that validates, caches and writes printer snapshots. It seeds defaults when empty and exposes helpers (`getSnapshot`, `registerPrinter`, `removePrinter`, `removeNode`, `upsertPrinterStates`).
- `src/routes/api/printer-registry/+server.ts`: REST-ish entry point that serves and mutates the registry. It delegates to `printerStore.ts` and responds with the updated snapshot.
- `src/routes/api/printer-overview/+server.ts` and peers: proxy Moonraker endpoints, normalize errors and forward payloads as JSON.

## Persistence
Data is stored in `data/printer-store.json`. The store keeps a short-lived in-memory cache (5 seconds) and rewrites the file after any mutation. The file stays human-friendly (pretty printed) so you can edit it manually when needed.

If the store cannot read the file (first boot or corruption), it falls back to an empty snapshot or seeds a default node/printer based on the incoming request data.

## Error Handling
- Moonraker fetch errors are captured and returned with an `ok: false` envelope so the UI can surface the failure without crashing.
- Store mutations throw explicit errors when required arguments are missing or when the target entity does not exist.
- Every API logs warnings to the server console to help diagnose connectivity issues.

## Extending the Backend
1. Add a helper inside `src/lib/server/` to implement the new behavior.
2. Create an endpoint under `src/routes/api/your-endpoint/+server.ts` that calls the helper and returns JSON.
3. Reuse the `safeFetch` helper from existing endpoints if you are calling Moonraker.
4. Update the frontend to call the new endpoint via `fetch` and handle the JSON envelope.
