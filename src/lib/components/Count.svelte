<!-- A number on a button that wants doing: the Due Words on the Page, on Practice. -->
<script lang="ts">
	let { value }: { value: number } = $props();
</script>

<span class="count">{value}</span>

<style>
	.count {
		margin-inline-start: 0.25rem;
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 0.8rem;
		font-weight: 600;
	}
</style>
