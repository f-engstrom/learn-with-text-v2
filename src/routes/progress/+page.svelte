<script lang="ts">
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Meter from '#lib/components/Meter.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const number = new Intl.NumberFormat();
	const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
	const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
	const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
	const fullDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

	/** A YYYY-MM-DD day as a local date. */
	const local = (day: string) => {
		const [y, m, d] = day.split('-').map(Number);
		return new Date(y, m - 1, d);
	};
	const plural = (n: number, one: string, many: string) => `${number.format(n)} ${n === 1 ? one : many}`;

	/** A Known Terms line as SVG points in a 100 × 40 box, with room for the line's width. */
	function line(values: number[]): string {
		const max = Math.max(...values);
		const min = Math.min(...values);
		const span = max - min || 1;
		return values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${38 - ((v - min) / span) * 36}`).join(' ');
	}
</script>

<svelte:head>
	<title>Progress · Reader</title>
</svelte:head>

<PageHeader title="Progress" />

{#if data.languages.length === 0}
	<p class="note">Nothing yet. Progress fills in as you read Books and save Terms.</p>
{/if}

{#each data.languages as p (p.language.id)}
	{@const weekMax = Math.max(...p.weeks.map((w) => w.words), 1)}
	{@const dueMax = Math.max(...p.forecast.map((d) => d.due), 1)}
	{@const first = p.knownHistory[0]}
	<section class="card language" aria-labelledby="language-{p.language.id}">
		<h2 id="language-{p.language.id}">{p.language.name}</h2>

		<div class="figures">
			<div class="figure">
				<span class="label">Words read</span>
				<strong>{number.format(p.wordsRead)}</strong>
				{#if p.milestone.next}
					{@const from = p.milestone.passed ?? 0}
					{@const share = (p.wordsRead - from) / (p.milestone.next - from)}
					<Meter value={share} label="{percent.format(share)} of the way to {number.format(p.milestone.next)}" />
					<small>
						{#if p.milestone.passed}Passed {number.format(p.milestone.passed)} · {/if}next {number.format(p.milestone.next)}
					</small>
				{:else}
					<small>Every Milestone passed</small>
				{/if}
			</div>
			<div class="figure">
				<span class="label">Known Terms</span>
				<strong>{number.format(p.known)}</strong>
				<small>{number.format(p.learning)} Learning</small>
			</div>
			<div class="figure">
				<span class="label">This week</span>
				<ol class="days" aria-label="Reading days this week">
					{#each p.week as d (d.day)}
						<li
							class:reading={d.reading}
							title="{fullDate.format(local(d.day))}: {d.reading ? `${plural(d.words, 'Word', 'Words')} read` : 'no reading'}"
						>
							<span class="dot" aria-hidden="true"></span>
							<span class="day">{weekday.format(local(d.day)).slice(0, 2)}</span>
							<span class="visually-hidden">{d.reading ? `, read ${d.words} Words` : ''}</span>
						</li>
					{/each}
				</ol>
			</div>
		</div>

		<div class="charts">
			<figure>
				<figcaption>Words read per week</figcaption>
				<ol class="bars" aria-label="Words read per week, oldest first">
					{#each p.weeks as w, i (w.start)}
						<li title="Week of {date.format(local(w.start))}: {plural(w.words, 'Word', 'Words')}">
							<span class="mark" style:height="{(w.words / weekMax) * 100}%"></span>
							<span class="visually-hidden">Week of {date.format(local(w.start))}: {w.words}</span>
							{#if i === p.weeks.length - 1}<span class="value">{number.format(w.words)}</span>{/if}
						</li>
					{/each}
				</ol>
				<div class="axis" aria-hidden="true">
					<span>{date.format(local(p.weeks[0].start))}</span>
					<span>This week</span>
				</div>
			</figure>

			<figure>
				<figcaption>Known Terms</figcaption>
				{#if p.knownHistory.length > 1}
					<svg class="line" viewBox="0 0 100 40" preserveAspectRatio="none" role="img"
						aria-label="Known Terms from {number.format(first.known)} on {date.format(local(first.day))} to {number.format(p.known)} today"
					>
						<polyline points={line(p.knownHistory.map((d) => d.known))} vector-effect="non-scaling-stroke" />
					</svg>
					<div class="axis" aria-hidden="true">
						<span>{date.format(local(first.day))} · {number.format(first.known)}</span>
						<span>Today · {number.format(p.known)}</span>
					</div>
				{:else}
					<p class="note">The line starts today, at {number.format(p.known)}.</p>
				{/if}
			</figure>

			<figure>
				<figcaption>Due forecast</figcaption>
				<ol class="bars forecast" aria-label="Terms coming Due on each of the next 14 days, today first">
					{#each p.forecast as d, i (d.day)}
						<li title="{i === 0 ? 'Today, with everything already Due' : fullDate.format(local(d.day))}: {plural(d.due, 'Term', 'Terms')}">
							<span class="mark" style:height="{(d.due / dueMax) * 100}%"></span>
							<span class="visually-hidden">{i === 0 ? 'Today' : fullDate.format(local(d.day))}: {d.due}</span>
							{#if i === 0 && d.due > 0}<span class="value">{number.format(d.due)}</span>{/if}
						</li>
					{/each}
				</ol>
				<div class="axis" aria-hidden="true">
					<span>Today</span>
					<span>{date.format(local(p.forecast.at(-1)!.day))}</span>
				</div>
			</figure>
		</div>
	</section>
{/each}

<style>
	.language {
		margin-bottom: 1.5rem;
	}
	.language h2 {
		margin: 0 0 1rem;
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 1.25rem 2rem;
		margin-bottom: 1.5rem;
	}
	.figure {
		display: grid;
		align-content: start;
		gap: 0.3rem;
	}
	.label,
	figcaption {
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.figure strong {
		font-family: var(--font-text);
		font-size: 2rem;
		font-weight: 600;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	/* Reading days: ink dots; a day without reading is an empty ring, never a warning. */
	.days {
		display: flex;
		gap: 0.55rem;
		margin: 0.35rem 0 0;
		padding: 0;
		list-style: none;
	}
	.days li {
		display: grid;
		justify-items: center;
		gap: 0.25rem;
	}
	.dot {
		width: 0.85rem;
		height: 0.85rem;
		border: 1.5px solid var(--border);
		border-radius: 50%;
	}
	.reading .dot {
		border-color: var(--accent);
		background: var(--accent);
	}
	.days .day {
		color: var(--muted);
		font-size: 0.72rem;
	}
	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1.5rem 2rem;
	}
	figure {
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 5rem;
		margin: 0;
		padding: 0;
		list-style: none;
		border-bottom: 1px solid var(--border);
	}
	.bars li {
		position: relative;
		flex: 1;
		display: flex;
		align-items: flex-end;
		height: 100%;
	}
	.bars .mark {
		width: 100%;
		min-height: 0;
		border-radius: 4px 4px 0 0;
		background: color-mix(in srgb, var(--accent) 75%, transparent);
	}
	.bars li:hover .mark {
		background: var(--accent);
	}
	.bars .value {
		position: absolute;
		inset-inline-end: 0;
		bottom: 100%;
		margin-bottom: 0.2rem;
		color: var(--text);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.forecast .value {
		inset-inline: 0 auto;
	}
	.line {
		width: 100%;
		height: 5rem;
		overflow: visible;
		border-bottom: 1px solid var(--border);
	}
	.line polyline {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2px;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 0.75rem;
	}
	figure .note {
		margin: 0;
	}
</style>
