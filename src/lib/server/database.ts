import { DATABASE_PATH } from '$app/env/private';
import type { Kysely } from 'kysely';
import { openDatabase } from './db/open';
import type { Database } from './db/schema';

let db: Kysely<Database> | undefined;

/** The web app's database connection. Domain code takes a connection as a parameter instead of importing this. */
export function database(): Kysely<Database> {
	db ??= openDatabase(DATABASE_PATH);
	return db;
}
