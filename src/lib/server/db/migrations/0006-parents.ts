import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable('term')
		.addColumn('parent_id', 'integer', (col) => col.references('term.id').onDelete('set null'))
		.execute();
	await db.schema
		.alterTable('term')
		.addColumn('follows_parent', 'integer', (col) => col.notNull().defaultTo(0))
		.execute();
	await db.schema.createIndex('term_parent').on('term').column('parent_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropIndex('term_parent').execute();
	await db.schema.alterTable('term').dropColumn('follows_parent').execute();
	await db.schema.alterTable('term').dropColumn('parent_id').execute();
}
