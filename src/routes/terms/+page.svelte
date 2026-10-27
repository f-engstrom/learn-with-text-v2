<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import TermForm from '#lib/components/TermForm.svelte';
	import { actionUrl } from '#lib/actions.ts';
	import { dueLabel, frequencyLabels, levelLabels, transferLabel } from '#lib/practice.ts';
	import type { Source, Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const statusLabels: Record<Status, string> = {
		learning1: 'Learning 1',
		learning2: 'Learning 2',
		learning3: 'Learning 3',
		learning4: 'Learning 4',
		known: 'Known',
		ignored: 'Ignored'
	};
	const sourceLabels: Record<Source, string> = { you: 'You', wiktionary: 'Wiktionary', tutor: 'Tutor' };

	/** The Term whose form is open below its row. */
	let editing = $state<number | undefined>();
	let error = $state<string | undefined>();

	const languageOf = (id: number) => data.languages.find((l) => l.id === id)!;
	const dirOf = (id: number): 'rtl' | 'ltr' => (languageOf(id).rightToLeft ? 'rtl' : 'ltr');
	let first = $derived(data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1);
	let last = $derived(Math.min(data.page * data.pageSize, data.total));

	function pageUrl(n: number) {
		const params = new URLSearchParams(page.url.search);
		params.set('page', String(n));
		return `?${params}`;
	}

	async function setStatus(term: { languageId: number; text: string }, status: string) {
		const body = new FormData();
		body.set('languageId', String(term.languageId));
		body.set('text', term.text);
		body.set('status', status);
		const response = await fetch('?/setStatus', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await response.text());
		error = result.type === 'failure' ? String(result.data?.message) : undefined;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Terms · Reader</title>
</svelte:head>

<header class="page-header">
	<h1>Terms</h1>
	<a class="button primary" href="/terms/review{data.filter.language ? `?language=${data.filter.language}` : ''}">Review Due Terms</a>
</header>

<form method="GET" class="filters card" data-sveltekit-keepfocus data-sveltekit-replacestate>
	<label>
		Language
		<select name="language" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">All</option>
			{#each data.languages as language (language.id)}
				<option value={language.id} selected={data.filter.language === language.id}>{language.name}</option>
			{/each}
		</select>
	</label>
	<label>
		Status
		<select name="status" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Any</option>
			<option value="learning" selected={data.filter.status === 'learning'}>Learning 1–4</option>
			{#each Object.entries(statusLabels) as [value, label] (value)}
				<option {value} selected={data.filter.status === value}>{label}</option>
			{/each}
		</select>
	</label>
	<label>
		Translation Source
		<select name="source" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Any</option>
			{#each Object.entries(sourceLabels) as [value, label] (value)}
				<option {value} selected={data.filter.source === value}>{label}</option>
			{/each}
		</select>
	</label>
	<label>
		Practice
		<select name="due" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Any</option>
			<option value="due" selected={data.filter.due === 'due'}>Due now</option>
			<option value="later" selected={data.filter.due === 'later'}>Not Due yet</option>
		</select>
	</label>
	<label>
		Recall
		<select name="recall" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Any</option>
			<option value="none" selected={data.filter.recall === 'none'}>No Reviews yet</option>
			{#each ['learning1', 'learning2', 'learning3', 'learning4', 'known'] as const as level (level)}
				<option value={level} selected={data.filter.recall === level}>{levelLabels[level]}</option>
			{/each}
		</select>
	</label>
	<label>
		Frequency
		<select name="frequency" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Any</option>
			{#each Object.entries(frequencyLabels) as [value, label] (value)}
				<option {value} selected={data.filter.frequency === value}>{label}</option>
			{/each}
		</select>
	</label>
	<label>
		Search
		<input type="search" name="q" value={data.filter.q} placeholder="Term or Translation" />
	</label>
	<button>Filter</button>
</form>

<p class="summary">
	{#if data.total === 0}
		No Terms match.
	{:else}
		{first}–{last} of {data.total} {data.total === 1 ? 'Term' : 'Terms'}
		{#if data.page > 1}<a href={pageUrl(data.page - 1)}>← Newer</a>{/if}
		{#if last < data.total}<a href={pageUrl(data.page + 1)}>Older →</a>{/if}
	{/if}
</p>
{#if error ?? form?.message}
	<p class="error" role="alert">{error ?? form?.message}</p>
{/if}

{#if data.terms.length > 0}
	<div class="table-wrap">
	<table class="terms data">
		<thead>
			<tr>
				<th scope="col">Term</th>
				{#if !data.filter.language}<th scope="col">Language</th>{/if}
				<th scope="col">Status</th>
				<th scope="col">Translations</th>
				<th scope="col">Parent</th>
				<th scope="col">Practice</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.terms as term (term.id)}
				<tr class:open={editing === term.id}>
					<td class="term-cell">
						<span class="term" lang={languageOf(term.languageId).code} dir={dirOf(term.languageId)}>{term.text}</span>
						{#if term.pronunciation}<small class="pronunciation">{term.pronunciation}</small>{/if}
						{#if term.frequency}<small class="frequency">{frequencyLabels[term.frequency]}</small>{/if}
					</td>
					{#if !data.filter.language}<td class="language">{languageOf(term.languageId).name}</td>{/if}
					<td class="status-cell">
						<select
							class="status {term.status}"
							aria-label="Status of {term.text}"
							value={term.status}
							onchange={(e) => setStatus(term, e.currentTarget.value)}
						>
							{#each Object.entries(statusLabels) as [value, label] (value)}
								<option {value}>{label}</option>
							{/each}
						</select>
					</td>
					<td class="translations">
						{#each term.translations as translation, i (translation.id)}{#if i > 0}; {/if}{translation.text}{#if translation.source !== 'you'}
								<small class="source">{sourceLabels[translation.source]}</small>{/if}{/each}
					</td>
					<td class="parent">
						{#if term.parent}<span lang={languageOf(term.languageId).code} dir={dirOf(term.languageId)}>{term.parent.text}</span>{/if}
						{#if term.children > 0}<small class="children">{term.children} {term.children === 1 ? 'form' : 'forms'}</small>{/if}
					</td>
					<td class="practice">
						{#if term.practice}
							<span class="due due-{term.practice.overdue}">{dueLabel(term.practice)}</span>
							{#if term.practice.recall}<small>Recall {levelLabels[term.practice.recall.level]}</small>{/if}
						{/if}
						{#if term.tutor}<small>Tutor {levelLabels[term.tutor]}</small>{/if}
						{#if term.transfer}<small title={term.transfer.reason}>Transfer: {transferLabel(term.transfer)}</small>{/if}
					</td>
					<td class="actions">
						<button type="button" onclick={() => (editing = editing === term.id ? undefined : term.id)}
							>{editing === term.id ? 'Close' : 'Edit'}</button
						>
						<form
							method="POST"
							action={actionUrl('deleteTerm', page.url.search)}
							use:enhance={({ cancel }) => {
								if (!confirm(`Delete the Term “${term.text}”? Its Words become Unknown again.`)) cancel();
							}}
						>
							<input type="hidden" name="id" value={term.id} />
							<button class="delete">Delete</button>
						</form>
					</td>
				</tr>
				{#if editing === term.id}
					<tr class="editor">
						<td colspan="7">
							{#key JSON.stringify(term)}
								<TermForm language={languageOf(term.languageId)} text={term.text} {term} error={form?.message} />
							{/key}
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
	</div>
{/if}

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: end;
		margin-bottom: 1rem;
	}
	.filters label {
		font-size: 0.9rem;
	}
	.filters input[type='search'] {
		min-width: 14rem;
	}
	/* A phone: filters two to a row, search and Filter on their own. */
	@media (max-width: 40rem) {
		.filters {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.filters select,
		.filters input[type='search'] {
			width: 100%;
			min-width: 0;
		}
		.filters label:has(input[type='search']) {
			grid-column: 1 / -1;
		}
		.filters button {
			justify-self: start;
		}
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		color: var(--muted);
	}
	.term {
		font-family: var(--font-text);
		font-size: 1.15rem;
	}
	.terms select {
		padding-block: 0.25rem;
	}
	.pronunciation,
	.frequency,
	.children {
		display: block;
		color: var(--muted);
	}
	.source {
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.8rem;
	}
	.actions {
		display: flex;
		gap: 0.35rem;
		justify-content: flex-end;
	}
	.actions form {
		display: contents;
	}
	/* A phone: each Term is a small card (Term and Status, then meaning, practice and actions). */
	@media (max-width: 40rem) {
		.terms thead {
			display: none;
		}
		.terms tbody tr:not(.editor) {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.35rem 0.75rem;
			padding: 0.75rem 1rem;
			border-top: 1px solid var(--border);
		}
		.terms tbody tr:not(.editor) td {
			padding: 0;
			border: none;
		}
		.terms td.language {
			display: none;
		}
		.terms td.translations,
		.terms td.parent,
		.terms td.practice,
		.terms td.actions {
			grid-column: 1 / -1;
		}
		.terms td.parent:empty,
		.terms td.practice:empty {
			display: none;
		}
		.terms td.practice {
			white-space: normal;
		}
		.terms td.practice small {
			display: inline;
			margin-inline-start: 0.5rem;
		}
		.terms td.actions {
			justify-content: flex-start;
		}
		.terms tr.editor,
		.terms tr.editor td {
			display: block;
		}
	}
	.delete {
		color: var(--danger);
	}
	.practice {
		white-space: nowrap;
	}
	.practice small {
		display: block;
		color: var(--muted);
	}
	.due-1 {
		color: var(--due-1-text);
	}
	.due-2 {
		color: var(--due-2-text);
	}
	.due-3 {
		color: var(--due-3-text);
		font-weight: 600;
	}
	.editor td {
		padding: 1rem 1.25rem 1.25rem;
		border-top: none;
		background: var(--surface-2);
	}
	.editor :global(form) {
		max-width: 28rem;
	}
	.status.learning1 {
		background: var(--status-learning1);
	}
	.status.learning2 {
		background: var(--status-learning2);
	}
	.status.learning3 {
		background: var(--status-learning3);
	}
	.status.learning4 {
		background: var(--status-learning4);
	}
</style>
