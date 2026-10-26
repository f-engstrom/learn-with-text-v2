import type { Kysely } from 'kysely';

// Seed rows are frozen here on purpose: later changes to the defaults get their own migration.
const languages = [
	{ name: 'Bosnian', code: 'bs', right_to_left: 0, character_map: {} },
	{ name: 'Chinese', code: 'zh', right_to_left: 0, character_map: {} },
	// Arabic yeh and kaf map to their Persian forms.
	{ name: 'Farsi', code: 'fa', right_to_left: 1, character_map: { 'ي': 'ی', 'ك': 'ک' } },
	// Stress marks (combining acute and grave) are removed; ё stays distinct.
	{ name: 'Russian', code: 'ru', right_to_left: 0, character_map: { '́': '', '̀': '' } }
];

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('language')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('name', 'text', (col) => col.notNull().unique())
		.addColumn('code', 'text', (col) => col.notNull().unique())
		.addColumn('right_to_left', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('character_map', 'text', (col) => col.notNull().defaultTo('{}'))
		.execute();

	await db
		.insertInto('language')
		.values(languages.map((l) => ({ ...l, character_map: JSON.stringify(l.character_map) })))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('language').execute();
}
