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

	it('reads the Origin as rows from three parallel lists when the form shows it, and keeps it otherwise', () => {
		const form = new FormData();
		form.set(f.languageId, '4');
		form.set(f.text, 'чулок');
		form.set(f.status, 'learning1');
		expect(readTermForm(form).origin).toBeUndefined();
		form.set(f.origin, '');
		for (const [kind, language, word] of [
			['loanword', 'Turkish', 'çorap'],
			['cognate', 'English', 'sock']
		]) {
			form.append(f.originKind, kind);
			form.append(f.originLanguage, language);
			form.append(f.originWord, word);
		}
		form.set(f.originNote, 'via Tatar');
		form.set(f.originSource, 'wiktionary');
		expect(readTermForm(form).origin).toEqual({
			links: [
				{ kind: 'loanword', language: 'Turkish', word: 'çorap' },
				{ kind: 'cognate', language: 'English', word: 'sock' }
			],
			note: 'via Tatar',
			source: 'wiktionary'
		});
	});
});
