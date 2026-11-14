import type { Kysely } from 'kysely';

// Albanian and Indonesian, with their Dictionaries and Feeds. Seed rows are frozen here, as in 0001 and 0007.
// Both use the Latin script without stress marks, so neither has a character map yet (open questions in docs/directions.md).
const languages = [
	{ name: 'Albanian', code: 'sq', right_to_left: 0, character_map: {} },
	{ name: 'Indonesian', code: 'id', right_to_left: 0, character_map: {} }
];

const googleTranslate = (code: string) => ({
	name: 'Google Translate',
	url: `https://translate.google.com/?sl=${code}&tl=en&text=[TERM]`,
	// Google Translate refuses to be embedded.
	display: 'popup' as const
});

const dictionaries: Record<string, { name: string; url: string; display: 'embedded' | 'popup' }[]> = {
	sq: [
		{ name: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/[TERM]#Albanian', display: 'embedded' },
		googleTranslate('sq')
	],
	id: [
		{ name: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/[TERM]#Indonesian', display: 'embedded' },
		googleTranslate('id')
	]
};

// Each read and found in the language when seeded.
const feeds: Record<string, { name: string; url: string }[]> = {
	sq: [{ name: 'DW Albanian', url: 'https://rss.dw.com/rdf/rss-alb-all' }],
	id: [
		{ name: 'BBC Indonesia', url: 'https://feeds.bbci.co.uk/indonesia/rss.xml' },
		{ name: 'DW Indonesia', url: 'https://rss.dw.com/rdf/rss-ind-all' },
		{ name: 'ANTARA', url: 'https://www.antaranews.com/rss/terkini.xml' }
	]
};

export async function up(db: Kysely<any>): Promise<void> {
	await db
		.insertInto('language')
		.values(languages.map((l) => ({ ...l, character_map: JSON.stringify(l.character_map) })))
		.execute();

	const added: { id: number; code: string }[] = await db
		.selectFrom('language')
		.select(['id', 'code'])
		.where('code', 'in', Object.keys(dictionaries))
		.execute();
	await db
		.insertInto('dictionary')
		.values(added.flatMap((l) => dictionaries[l.code].map((d, i) => ({ language_id: l.id, position: i + 1, ...d }))))
		.execute();
	await db
		.insertInto('feed')
		.values(added.flatMap((l) => feeds[l.code].map((f) => ({ language_id: l.id, ...f }))))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	// Their Dictionaries, Feeds, Books and Terms go with them (foreign keys cascade).
	await db.deleteFrom('language').where('code', 'in', Object.keys(dictionaries)).execute();
}
