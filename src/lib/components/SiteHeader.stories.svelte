<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import SiteHeader from './SiteHeader.svelte';

	const { Story } = preview.meta({
		title: 'Components/Site header',
		component: SiteHeader,
		args: { path: '/' },
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story name="In Books" />
<Story name="Reading a Book" args={{ path: '/books/1/pages/3' }} />
<Story name="In Terms" args={{ path: '/terms/review' }} />
<Story name="In You" args={{ path: '/you' }} />
<Story name="On a phone" args={{ path: '/progress' }} globals={{ viewport: { value: 'phone' } }} />
