<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fn } from 'storybook/test';
	import Grades from './Grades.svelte';

	const { Story } = preview.meta({
		title: 'Components/Grades',
		component: Grades,
		args: { ongrade: fn() }
	});
</script>

<Story name="With their keys" args={{ keys: true }} />
<Story name="Without keys" args={{ label: 'Review' }} />
