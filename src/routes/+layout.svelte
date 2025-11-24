<script lang="ts">
	import './layout.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#each [$page.url.pathname] as pathname (pathname)}
	<div in:fade={{ duration: 160 }} out:fade={{ duration: 120 }}>
		<slot />
	</div>
{/each}
