import { describe, it, expect } from 'vitest';
import { passageParts } from './passage';

describe('passageParts', () => {
	const tokens = ['которые', ' ', 'сами', ' ', 'бы', ' ', 'охотно', ' ', 'грешили', ', ', 'если', ' ', 'б', ' ', 'умели', ', ', 'но'];

	it('gives the parts a passage covers, in any case and spacing', () => {
		expect(passageParts(tokens, 'Сами бы  охотно')).toEqual([2, 3, 4, 5, 6]);
		expect(passageParts(tokens, 'если б умели')).toEqual([10, 11, 12, 13, 14]);
	});

	it('runs across parts that end in spaces, like Sentences', () => {
		expect(passageParts(['Кот спит. ', 'Мышь бежит.'], 'спит. мышь')).toEqual([0, 1]);
	});

	it('is undefined when the passage is not there, or empty', () => {
		expect(passageParts(tokens, 'никогда')).toBeUndefined();
		expect(passageParts(tokens, '  ')).toBeUndefined();
	});
});
