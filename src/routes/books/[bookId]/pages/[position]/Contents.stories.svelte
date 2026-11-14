<script module lang="ts">
	import preview from '../../../../../../.storybook/preview';
	import Contents from './Contents.svelte';

	const chapter = (number: number, title: string, first: number, last: number, read: number) => ({
		number,
		title,
		label: title || `Chapter ${number}`,
		first,
		last,
		read
	});
	const chapters = [
		chapter(1, 'Глава первая. Ялта', 2, 5, 4),
		chapter(2, '', 6, 9, 1),
		chapter(3, 'Глава третья, в которой Гуров возвращается в Москву и не может забыть о встрече на набережной', 10, 14, 0)
	];

	const { Story } = preview.meta({
		title: 'Components/Reading/Contents',
		component: Contents,
		args: { bookId: 1, chapters, here: { number: 2, label: 'Chapter 2', page: 2, pages: 4 }, lang: 'ru' }
	});
</script>

<Story name="In an untitled Chapter" />
<Story name="A long title" args={{ here: { number: 3, label: chapters[2].label, page: 1, pages: 5 } }} />
<Story
	name="Open"
	play={async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByTitle('Chapters'));
	}}
/>
