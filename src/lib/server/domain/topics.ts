import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

export interface Topic {
	id: number;
	text: string;
}

export class InvalidTopic extends Error {}

export async function listTopics(db: Kysely<Database>): Promise<Topic[]> {
	return db.selectFrom('topic').select(['id', 'text']).orderBy('text').execute();
}

/** Adds a Topic; one you already have (in any case) is left as it is. */
export async function addTopic(db: Kysely<Database>, text: string): Promise<void> {
	const topic = text.trim().replace(/\s+/g, ' ');
	if (topic === '') throw new InvalidTopic('Type a Topic.');
	if (topic.length > 100) throw new InvalidTopic('Keep a Topic short, like "football" or "Roman history".');
	await db
		.insertInto('topic')
		.values({ text: topic })
		.onConflict((oc) => oc.column('text').doNothing())
		.execute();
}

export async function removeTopic(db: Kysely<Database>, id: number): Promise<void> {
	await db.deleteFrom('topic').where('id', '=', id).execute();
}
