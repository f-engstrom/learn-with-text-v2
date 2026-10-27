import type { Kysely } from 'kysely';

// Seed rows are frozen here on purpose: later changes to the defaults get their own migration.
// Each feed answered with recent items, and their articles extracted cleanly, when seeded.
const feeds: Record<string, { name: string; url: string }[]> = {
	bs: [
		{ name: 'Klix.ba', url: 'https://www.klix.ba/rss' },
		{ name: 'Al Jazeera Balkans', url: 'https://balkans.aljazeera.net/rss.xml' },
		{ name: 'N1 BiH', url: 'https://n1info.ba/feed/' }
	],
	fa: [
		{ name: 'BBC Persian', url: 'https://feeds.bbci.co.uk/persian/rss.xml' },
		{ name: 'DW Persian', url: 'https://rss.dw.com/rdf/rss-per-all' }
	],
	ru: [
		{ name: 'BBC Russian', url: 'https://feeds.bbci.co.uk/russian/rss.xml' },
		{ name: 'Meduza', url: 'https://meduza.io/rss/all' },
		{ name: 'DW Russian', url: 'https://rss.dw.com/rdf/rss-ru-all' }
	],
	zh: [
		{ name: 'BBC Chinese', url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml' },
		{ name: 'DW Chinese', url: 'https://rss.dw.com/rdf/rss-chi-all' }
	]
};

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('feed')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('language_id', 'integer', (col) => col.notNull().references('language.id').onDelete('cascade'))
		.addColumn('name', 'text', (col) => col.notNull())
		.addColumn('url', 'text', (col) => col.notNull())
		.addUniqueConstraint('feed_language_url', ['language_id', 'url'])
		.execute();

	const languages: { id: number; code: string }[] = await db.selectFrom('language').select(['id', 'code']).execute();
	const rows = languages.flatMap((l) => (feeds[l.code] ?? []).map((f) => ({ language_id: l.id, ...f })));
	if (rows.length > 0) await db.insertInto('feed').values(rows).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('feed').execute();
}
