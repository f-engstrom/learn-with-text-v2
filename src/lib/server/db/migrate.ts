import type { Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import * as m0001 from './migrations/0001-languages';

// Listed statically (not read from disk) so they survive bundling by Vite and the MCP entry point.
const migrations: Record<string, Migration> = {
	'0001-languages': m0001
};

export async function migrateToLatest(db: Kysely<any>): Promise<void> {
	const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
	const { error } = await migrator.migrateToLatest();
	if (error) throw error;
}
