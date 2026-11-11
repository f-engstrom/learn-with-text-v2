<!-- A number on a button that wants doing: the Due Words on the Page, on Practice. -->
<script lang="ts">
	let { value }: { value: number } = $props();
</script>

<span class="count">{value}</span>

<style>
	.count {
		margin-inline-start: 0.4rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--due-2);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 600;
	}
</style>
