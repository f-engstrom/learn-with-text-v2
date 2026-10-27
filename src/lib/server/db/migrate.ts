import type { Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import * as m0001 from './migrations/0001-languages';
import * as m0002 from './migrations/0002-books';
import * as m0003 from './migrations/0003-terms';
import * as m0004 from './migrations/0004-pronunciation';
import * as m0005 from './migrations/0005-bookmark-read';
import * as m0006 from './migrations/0006-parents';
import * as m0007 from './migrations/0007-dictionaries';
import * as m0008 from './migrations/0008-book-words';
import * as m0009 from './migrations/0009-suggestions';
import * as m0010 from './migrations/0010-feeds';
import * as m0011 from './migrations/0011-bookmark-word';
import * as m0012 from './migrations/0012-highlight';

// Listed statically (not read from disk) so they survive bundling by Vite and the MCP entry point.
const migrations: Record<string, Migration> = {
	'0001-languages': m0001,
	'0002-books': m0002,
	'0003-terms': m0003,
	'0004-pronunciation': m0004,
	'0005-bookmark-read': m0005,
	'0006-parents': m0006,
	'0007-dictionaries': m0007,
	'0008-book-words': m0008,
	'0009-suggestions': m0009,
	'0010-feeds': m0010,
	'0011-bookmark-word': m0011,
	'0012-highlight': m0012
};

export async function migrateToLatest(db: Kysely<any>): Promise<void> {
	const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
	const { error } = await migrator.migrateToLatest();
	if (error) throw error;
}
