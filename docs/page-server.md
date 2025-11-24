# `+page.server.ts`

The root route (`src/routes/+page.server.ts`) is responsible for gathering initial data before the dashboard renders. Running these calls on the server avoids CORS problems and sends ready-to-display data to the client.

## Responsibilities
- Fetch printer overview and status from the Moonraker proxies.
- Discover the default printer name when Moonraker exposes it.
- Load the printer registry snapshot from the local store and seed defaults when necessary.
- Provide a consistent data contract to the Svelte page via `load`.

## Data Contract
The `load` function returns an object similar to:

```ts
{
  overview: { ok: boolean, data?: OverviewPayload, error?: string },
  status: { ok: boolean, data?: StatusPayload, error?: string },
  registry: PrinterSnapshot
}
```

The Svelte component reads this structure to hydrate widgets on first paint while the browser takes over live updates.

## Default Seeding
When the registry is empty the server attempts to create a default node and printer using the Moonraker base URL from configuration. This prevents the UI from showing an empty screen on first launch.

## Extending the Loader
1. Import any additional server helpers you need (for example a new proxy).
2. Execute the calls in parallel using `Promise.all` to keep latency low.
3. Merge the results into the returned object. Keep the response envelope consistent so the page can handle successes and failures uniformly.
4. Update `src/routes/+page.svelte` with the new fields and propagate them to child components.
