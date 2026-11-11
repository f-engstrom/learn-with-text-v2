<script module lang="ts">
	import preview from '../../../.storybook/preview';
	import { fixtures } from '#fixtures';
	import Column from '#stories/Column.svelte';
	import TermForm from './TermForm.svelte';

	const { mixed, rightToLeft, characters } = fixtures.reading;
	const { Story } = preview.meta({
		title: 'Components/Term form',
		component: TermForm,
		args: { language: mixed.language, error: undefined },
		// As wide as the column beside the text.
		decorators: [() => ({ Component: Column })]
	});
</script>

<Story name="An Unknown Word" args={{ text: 'блондинка', term: undefined }} />
<Story name="Learning, from the Tutor" args={{ text: 'набережной', term: mixed.terms['набережной'] }} />
<Story name="Two Translations, two Sources" args={{ text: 'интересоваться', term: mixed.terms['интересоваться'] }} />
<Story name="Follows Parent" args={{ text: 'лицами', term: mixed.terms['лицами'] }} />
<Story name="A Multi-word Term" args={{ text: 'дама с собачкой', term: mixed.terms['дама с собачкой'] }} />
<Story name="Known" args={{ text: 'молодая', term: mixed.terms['молодая'] }} />
<Story name="Refused" args={{ text: 'лицами', term: mixed.terms['лицами'], error: 'A Term cannot be its own Parent.' }} />
<Story name="Right to left" args={{ language: rightToLeft.language, text: 'اعضای', term: rightToLeft.terms['اعضای'] }} />
<Story name="With a Pronunciation" args={{ language: characters.language, text: '喜欢', term: characters.terms['喜欢'] }} />
