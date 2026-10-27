import { sql, type Kysely } from 'kysely';

const googleTranslate = (code: string) => ({
	name: 'Google Translate',
	url: `https://translate.google.com/?sl=${code}&tl=en&text=[TERM]`,
	// Google Translate refuses to be embedded.
	display: 'popup' as const
});

// Seed rows are frozen here on purpose: later changes to the defaults get their own migration.
// `[TERM]` is replaced with the Term's Normalised form. Every 'embedded' site allowed framing when seeded.
const dictionaries: Record<string, { name: string; url: string; display: 'embedded' | 'popup' }[]> = {
	bs: [
		{ name: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/[TERM]#Serbo-Croatian', display: 'embedded' },
		googleTranslate('bs')
	],
	zh: [
		{ name: 'MDBG', url: 'https://www.mdbg.net/chinese/dictionary?wdqb=[TERM]', display: 'embedded' },
		{ name: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/[TERM]#Chinese', display: 'embedded' },
		googleTranslate('zh-CN')
	],
	fa: [
		{ name: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/[TERM]#Persian', display: 'embedded' },
		{ name: 'Abadis', url: 'https://abadis.ir/fatoen/[TERM]/', display: 'embedded' },
		googleTranslate('fa')
	],
	ru: [
		{ name: 'Wiktionary', url: 'https://en.m.wiktionary.org/wiki/[TERM]#Russian', display: 'embedded' },
		{ name: 'OpenRussian', url: 'https://en.openrussian.org/ru/[TERM]', display: 'embedded' },
		googleTranslate('ru')
	]
};

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('dictionary')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('language_id', 'integer', (col) => col.notNull().references('language.id').onDelete('cascade'))
		.addColumn('position', 'integer', (col) => col.notNull())
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('url', 'text', (col) => col.notNull())
		.addColumn('display', 'text', (col) => col.notNull().check(sql`display in ('embedded', 'popup')`))
		.addUniqueConstraint('dictionary_language_position', ['language_id', 'position'])
		.execute();

	const languages: { id: number; code: string }[] = await db.selectFrom('language').select(['id', 'code']).execute();
	const rows = languages.flatMap((l) =>
		(dictionaries[l.code] ?? []).map((d, i) => ({ language_id: l.id, position: i + 1, ...d }))
	);
	if (rows.length > 0) await db.insertInto('dictionary').values(rows).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('dictionary').execute();
}
