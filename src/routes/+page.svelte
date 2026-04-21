<script lang="ts">
	import { onMount } from 'svelte';

	let isHealthy = false;
	let apiStatus: any = {};

	onMount(async () => {
		try {
			const response = await fetch('http://localhost:8000/health');
			if (response.ok) {
				isHealthy = true;
				apiStatus = await response.json();
			}
		} catch (error) {
			console.error('Backend not available:', error);
			isHealthy = false;
		}
	});
</script>

<main class="mx-auto max-w-6xl space-y-6 p-6">
	<header class="space-y-2">
		<h1 class="text-3xl font-bold">🤖 PrintRobot - Ciclo 0</h1>
		<p class="text-gray-400">Sistema de Orquestación para Granjas de Impresoras 3D</p>
	</header>

	<section class="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
		<h2 class="mb-4 text-xl font-semibold">Estado del Sistema</h2>
		
		{#if isHealthy}
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<span class="h-3 w-3 rounded-full bg-green-500"></span>
					<span class="text-green-300">Backend: Activo ✓</span>
				</div>
				<div class="text-sm text-gray-400">
					<p><strong>Servicio:</strong> {apiStatus.service}</p>
					<p><strong>Versión:</strong> {apiStatus.version}</p>
					<p><strong>URL:</strong> http://localhost:8000</p>
				</div>
			</div>
		{:else}
			<div class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full bg-red-500"></span>
				<span class="text-red-300">Backend: Desconectado ✗</span>
			</div>
		{/if}
	</section>

	<section class="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
		<h2 class="mb-4 text-xl font-semibold">Rutas Disponibles</h2>
		<div class="space-y-2 text-sm">
			<p><code class="rounded bg-gray-800 px-2 py-1">GET /health</code> - Health check</p>
			<p><code class="rounded bg-gray-800 px-2 py-1">GET /docs</code> - Swagger OpenAPI</p>
			<p><code class="rounded bg-gray-800 px-2 py-1">POST /auth/login</code> - Login (próximamente)</p>
			<p><code class="rounded bg-gray-800 px-2 py-1">GET /printers</code> - Listar impresoras (próximamente)</p>
		</div>
	</section>

	<section class="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
		<h2 class="mb-4 text-xl font-semibold">Próximos Pasos</h2>
		<ul class="space-y-2 text-sm text-gray-300">
			<li>✓ Setup desarrollo completado</li>
			<li>✓ Frontend + Backend corriendo</li>
			<li>⏳ Crear modelos SQLAlchemy</li>
			<li>⏳ Primera migración Alembic</li>
			<li>⏳ Endpoints auth completos</li>
			<li>⏳ Dashboard con datos reales</li>
		</ul>
	</section>

	<footer class="border-t border-gray-700 pt-4 text-center text-sm text-gray-500">
		<p>PrintRobot v0.1.0 - Ciclo 0 MVP</p>
		<p><a href="http://localhost:8000/docs" class="text-blue-400 hover:underline">Ver API Docs →</a></p>
	</footer>
</main>
