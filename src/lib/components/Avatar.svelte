<!-- Who is speaking: the Tutor's T in a soft round, beside its turn and wherever it waits on you. -->
<script lang="ts">
	interface Props {
		/** Large where it leads a line of its own (the Tutor elsewhere in the Book). */
		size?: 'small' | 'large';
	}

	let { size = 'small' }: Props = $props();
</script>

<span class="avatar" class:large={size === 'large'} aria-hidden="true">T</span>

<style>
	.avatar {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 700;
	}
	.large {
		width: 1.75rem;
		height: 1.75rem;
	}
</style>
