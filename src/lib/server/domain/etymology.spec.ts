import { describe, it, expect } from 'vitest';
import { languageName, readEtymologies } from './etymology';

const page = (russian: string) => `==English==\n===Etymology===\n{{inh|en|enm|computer}}\n\n==Russian==\n${russian}\n----\n\n==Serbian==\n===Etymology===\n{{bor|sr|de|x}}\n`;

describe('languageName', () => {
	it('names a code, a proto-language, and keeps a code it does not know', () => {
		expect(languageName('ota')).toBe('Ottoman Turkish');
		expect(languageName('sla-pro')).toBe('Proto-Slavic');
		expect(languageName('xyz')).toBe('xyz');
	});
});

describe('readEtymologies', () => {
	it("reads the links of the Language's Etymology, in order, with its text as the note", () => {
		const wikitext = page(
			"===Etymology===\n{{bor+|ru|en|computer}}, from {{der|ru|la|computō||to compute}}. Compare {{cog|uk|комп'ютер}}.<ref>A source</ref>\n\n===Pronunciation===\n* {{ru-IPA|компью́тер}}\n\n===Noun===\n{{ru-noun+|компью́тер}}"
		);
		expect(readEtymologies(wikitext, 'Russian')).toEqual([
			{
				heading: 'Etymology',
				links: [
					{ kind: 'loanword', language: 'English', word: 'computer' },
					{ kind: 'derived', language: 'Latin', word: 'computō' },
					{ kind: 'cognate', language: 'Ukrainian', word: "комп'ютер" }
				],
				note: "Borrowed from English computer, from Latin computō (“to compute”). Compare Ukrainian комп'ютер."
			}
		]);
	});

	it('reads each numbered Etymology of a page on its own, and nested templates', () => {
		const wikitext = page(
			"===Etymology 1===\nFrom {{inh|ru|orv|{{l|orv|лукъ}}}}, from {{inh|ru|sla-pro|*lǫkъ}}.\n====Noun====\nbow\n===Etymology 2===\n{{calque|ru|de|Zwiebel}}; ''see'' [[лук|onion]].\n"
		);
		const found = readEtymologies(wikitext, 'Russian');
		expect(found.map((e) => e.heading)).toEqual(['Etymology 1', 'Etymology 2']);
		expect(found[0].links).toEqual([
			{ kind: 'inherited', language: 'Old East Slavic', word: 'лукъ' },
			{ kind: 'inherited', language: 'Proto-Slavic', word: '*lǫkъ' }
		]);
		expect(found[1]).toEqual({ heading: 'Etymology 2', links: [{ kind: 'calque', language: 'German', word: 'Zwiebel' }], note: 'Calque of German Zwiebel; see onion.' });
	});

	it('reads the newer etymon template as a chain', () => {
		const wikitext = page('===Etymology===\n{{etymon|ru|id=book|:bor|ota:کتاب<id:book>|:der|ar:كِتَاب|tree=1|text=++}}.');
		expect(readEtymologies(wikitext, 'Russian')).toEqual([
			{
				heading: 'Etymology',
				links: [
					{ kind: 'loanword', language: 'Ottoman Turkish', word: 'کتاب' },
					{ kind: 'derived', language: 'Arabic', word: 'كِتَاب' }
				],
				note: 'Borrowed from Ottoman Turkish کتاب, from Arabic كِتَاب.'
			}
		]);
	});

	it('keeps a section with text only, and finds nothing when the Language has no Etymology', () => {
		expect(readEtymologies(page('===Etymology===\nOf unclear origin.\n'), 'Russian')).toEqual([{ heading: 'Etymology', links: [], note: 'Of unclear origin.' }]);
		expect(readEtymologies(page('===Noun===\nx'), 'Russian')).toEqual([]);
		expect(readEtymologies(page('===Etymology===\nx'), 'Persian')).toEqual([]);
	});
});
