import type { ServerInit } from '@sveltejs/kit/hooks';
import { database } from '#lib/server/database.ts';
import { migrateToLatest } from '#lib/server/db/migrate.ts';

export const init: ServerInit = async () => {
	await migrateToLatest(database());
};
