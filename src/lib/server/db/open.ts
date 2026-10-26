import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './schema';

/**
 * Opens the SQLite file at `path` (or ':memory:').
 * WAL and a busy timeout let the web app and the MCP server write at the same time (ADR 0003).
 */
export function openDatabase(path: string): Kysely<Database> {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new SQLite(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('busy_timeout = 5000');
	sqlite.pragma('foreign_keys = ON');
	return new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });
}
