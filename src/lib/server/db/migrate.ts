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
import * as m0013 from './migrations/0013-practice';
import * as m0014 from './migrations/0014-frequency';
import * as m0015 from './migrations/0015-tutor-assessment';
import * as m0016 from './migrations/0016-highlight-passage';
import * as m0017 from './migrations/0017-progress';
import * as m0018 from './migrations/0018-tutor-question';
import * as m0019 from './migrations/0019-terms-version';
import * as m0020 from './migrations/0020-tutor-question-glosses';
import * as m0021 from './migrations/0021-azure-source';
import * as m0022 from './migrations/0022-one-book-per-address';
import * as m0023 from './migrations/0023-albanian-indonesian';
import * as m0024 from './migrations/0024-origin';
import * as m0025 from './migrations/0025-hyphenated-words';
import * as m0026 from './migrations/0026-chapters';

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
	'0012-highlight': m0012,
	'0013-practice': m0013,
	'0014-frequency': m0014,
	'0015-tutor-assessment': m0015,
	'0016-highlight-passage': m0016,
	'0017-progress': m0017,
	'0018-tutor-question': m0018,
	'0019-terms-version': m0019,
	'0020-tutor-question-glosses': m0020,
	'0021-azure-source': m0021,
	'0022-one-book-per-address': m0022,
	'0023-albanian-indonesian': m0023,
	'0024-origin': m0024,
	'0025-hyphenated-words': m0025,
	'0026-chapters': m0026
};

export async function migrateToLatest(db: Kysely<any>): Promise<void> {
	const { error } = await migrator(db).migrateToLatest();
	if (error) throw error;
}

/** Migrates up or down to a named migration, e.g. to test one on data saved before it. */
export async function migrateTo(db: Kysely<any>, name: string): Promise<void> {
	const { error } = await migrator(db).migrateTo(name);
	if (error) throw error;
}

function migrator(db: Kysely<any>): Migrator {
	return new Migrator({ db, provider: { getMigrations: async () => migrations } });
}
