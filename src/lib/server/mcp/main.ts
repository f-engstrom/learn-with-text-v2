// The Reader's MCP server over stdio (ADR 0003): `npm run --silent mcp`. Claude starts it; it
// opens the same SQLite file as the web app, which needn't be running.
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from '../db/open';
import { migrateToLatest } from '../db/migrate';
import { feedsFromWeb } from '../domain/feeds';
import { wikipediaFromWeb } from '../domain/suggestions';
import { createReaderServer } from './tools';

// Relative to the project, not to wherever Claude was started, like the web app's default.
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const configured = process.env.DATABASE_PATH || 'data/reader.db';
const db = openDatabase(isAbsolute(configured) ? configured : resolve(projectRoot, configured));
await migrateToLatest(db);

// stdout carries the protocol, so nothing else may print there.
await createReaderServer(db, { wikipedia: wikipediaFromWeb(), feeds: feedsFromWeb() }).connect(new StdioServerTransport());
