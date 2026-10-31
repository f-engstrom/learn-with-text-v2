import { database } from '#lib/server/database.ts';
import { getProgress } from '#lib/server/domain/progress.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ languages: await getProgress(database()) });
