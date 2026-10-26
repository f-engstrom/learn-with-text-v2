import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('term')
		.addColumn('pronunciation', 'text', (col) => col.notNull().defaultTo(''))
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.alterTable('term').dropColumn('pronunciation').execute();
}
