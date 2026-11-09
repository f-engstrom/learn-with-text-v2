import { describe, it, expect } from 'vitest';
import { readTermForm, termFields as f } from './term-writes';

describe('readTermForm', () => {
	it('reads the Term form, its Translations as rows from three parallel lists', () => {
		const form = new FormData();
		form.set(f.languageId, '4');
		form.set(f.text, 'читала');
		form.set(f.status, 'learning2');
		for (const [id, source, text] of [
			['7', 'wiktionary', 'read (past)'],
			['', 'you', 'was reading']
		]) {
			form.append(f.translationId, id);
			form.append(f.translationSource, source);
			form.append(f.translationText, text);
		}
		form.set(f.pronunciation, '');
		form.set(f.parent, 'читать');
		form.set(f.followsParent, 'on');
		expect(readTermForm(form)).toEqual({
			languageId: 4,
			text: 'читала',
			status: 'learning2',
			pronunciation: '',
			parent: 'читать',
			followsParent: true,
			translations: [
				{ id: 7, text: 'read (past)', source: 'wiktionary' },
				{ id: undefined, text: 'was reading', source: 'you' }
			]
		});
	});

	it('reads an unticked Follows Parent and no Translations', () => {
		const form = new FormData();
		form.set(f.languageId, '4');
		form.set(f.text, 'кот');
		form.set(f.status, 'known');
		expect(readTermForm(form)).toMatchObject({ followsParent: false, translations: [], parent: '' });
	});
});
