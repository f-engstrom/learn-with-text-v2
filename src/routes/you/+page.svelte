<script lang="ts">
	import AddForm from '#lib/components/AddForm.svelte';
	import Button from '#lib/components/Button.svelte';
	import { enhance } from '$app/forms';
	import type { YourLanguageLevel } from '#lib/server/domain/your-languages.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const levelLabels: Record<YourLanguageLevel, string> = { native: 'Native', fluent: 'Fluent', some: 'Some' };
	const levels = Object.keys(levelLabels) as YourLanguageLevel[];
</script>

<svelte:head>
	<title>Your languages · Reader</title>
</svelte:head>

<h1>Your languages</h1>
<p class="lede">
	The languages you already know. The Tutor judges Transfer (how hard a Word is to carry over) against these and bridges to them in
	explanations; it adds them too when you mention one.
</p>

<div class="card">
	{#if data.languages.length === 0}
		<p class="note">None yet.</p>
	{:else}
		<ul class="languages">
			{#each data.languages as language (language.name)}
				<li>
					<span class="name">{language.name}</span>
					<form method="POST" action="?/set" use:enhance>
						<input type="hidden" name="name" value={language.name} />
						<select name="level" aria-label="How well you know {language.name}" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
							{#each levels as level (level)}
								<option value={level} selected={language.level === level}>{levelLabels[level]}</option>
							{/each}
						</select>
					</form>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="name" value={language.name} />
						<Button aria-label="Remove {language.name}">✕</Button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<AddForm action="?/set" label="Add" message={form?.message}>
		<input name="name" placeholder="e.g. Swedish" aria-label="Language" autocomplete="off" required />
		<select name="level" aria-label="How well">
			{#each levels as level (level)}
				<option value={level} selected={level === 'fluent'}>{levelLabels[level]}</option>
			{/each}
		</select>
	</AddForm>
</div>

<style>
	.languages {
		display: grid;
		gap: 0.5rem;
		margin: 0 0 1.25rem;
		padding: 0;
		list-style: none;
		max-width: 28rem;
	}
	.languages li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 0.5rem;
		align-items: center;
	}
	.name {
		font-weight: 500;
	}
	.languages :global(button) {
		padding: 0.2rem 0.5rem;
	}
	.card > .note {
		margin-top: 0;
	}
</style>
