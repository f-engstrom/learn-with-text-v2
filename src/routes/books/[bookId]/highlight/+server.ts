import { json } from '@sveltejs/kit';
import { database } from '#lib/server/database.ts';
import { getHighlight } from '#lib/server/domain/reading.ts';
import type { RequestHandler } from './$types';

/** The Book's Highlight, or null: the reading screen polls this to show the Tutor's Highlight as it's set. */
export const GET: RequestHandler = async ({ params }) => json((await getHighlight(database(), Number(params.bookId))) ?? null);
