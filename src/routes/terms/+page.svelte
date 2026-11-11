<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { enhance } from '$app/forms';
	import { sendStatus } from '#lib/term-writes.ts';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import TermForm from '#lib/components/TermForm.svelte';
	import { actionUrl } from '#lib/actions.ts';
	import Due from '#lib/components/Due.svelte';
	import SourceTag from '#lib/components/SourceTag.svelte';
	import { frequencyLabels, transferLabel } from '#lib/practice.ts';
	import { LEVELS, sourceLabels, statusLabels } from '#lib/terms.ts';
	import type { Status } from '#lib/server/domain/terms.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();


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
		error = await sendStatus(term.languageId, term.text, status);
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Terms · Reader</title>
</svelte:head>

<PageHeader title="Terms">
	<Button href="/terms/review{data.filter.language ? `?language=${data.filter.language}` : ''}" variant="primary">Review Due Terms</Button>
</PageHeader>

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
			{#each LEVELS as level (level)}
				<option value={level} selected={data.filter.recall === level}>{statusLabels[level]}</option>
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
	<Button>Filter</Button>
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
							class="status status-{term.status}"
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
								<SourceTag source={translation.source} />{/if}{/each}
					</td>
					<td class="parent">
						{#if term.parent}<span lang={languageOf(term.languageId).code} dir={dirOf(term.languageId)}>{term.parent.text}</span>{/if}
						{#if term.children > 0}<small class="children">{term.children} {term.children === 1 ? 'form' : 'forms'}</small>{/if}
					</td>
					<td class="practice">
						{#if term.practice}
							<Due practice={term.practice} />
							{#if term.practice.recall}<small>Recall {statusLabels[term.practice.recall.level]}</small>{/if}
						{/if}
						{#if term.tutorAssessment}<small>Tutor {statusLabels[term.tutorAssessment]}</small>{/if}
						{#if term.transfer}<small title={term.transfer.reason}>Transfer: {transferLabel(term.transfer)}</small>{/if}
					</td>
					<td class="actions">
						<Button type="button" onclick={() => (editing = editing === term.id ? undefined : term.id)}
							>{editing === term.id ? 'Close' : 'Edit'}</Button
						>
						<form
							method="POST"
							action={actionUrl('deleteTerm', page.url.search)}
							use:enhance={({ cancel }) => {
								if (!confirm(`Delete the Term “${term.text}”? Its Words become Unknown again.`)) cancel();
							}}
						>
							<input type="hidden" name="id" value={term.id} />
							<Button variant="danger">Delete</Button>
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
		.filters :global(button) {
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
	.practice {
		white-space: nowrap;
	}
	.practice small {
		display: block;
		color: var(--muted);
	}
	.editor td {
		padding: 1rem 1.25rem 1.25rem;
		border-top: none;
		background: var(--surface-2);
	}
	.editor :global(form) {
		max-width: 28rem;
	}
	.status {
		background: var(--status, color-mix(in srgb, var(--surface) 70%, var(--bg)));
	}
</style>
