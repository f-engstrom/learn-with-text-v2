<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import Avatar from './Avatar.svelte';

	const { Story } = preview.meta({ title: 'Components/Avatar', component: Avatar });
</script>

<Story name="Small" />
<Story name="Large" args={{ size: 'large' }} />
