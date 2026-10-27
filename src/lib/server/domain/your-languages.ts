import type { Kysely } from 'kysely';
import type { Database, YourLanguageTable } from '../db/schema';

// Your languages: what Transfer and the Tutor's bridges are measured against (see CONTEXT.md).

export type YourLanguageLevel = YourLanguageTable['level'];
export const YOUR_LANGUAGE_LEVELS: readonly YourLanguageLevel[] = ['native', 'fluent', 'some'];

export class InvalidYourLanguage extends Error {}

export interface YourLanguage {
	name: string;
	level: YourLanguageLevel;
}

/** Native first, then fluent, then some; in the order added within each. */
export async function listYourLanguages(db: Kysely<Database>): Promise<YourLanguage[]> {
	const rows = await db.selectFrom('your_language').select(['name', 'level']).orderBy('added_at').execute();
	return rows.sort((a, b) => YOUR_LANGUAGE_LEVELS.indexOf(a.level) - YOUR_LANGUAGE_LEVELS.indexOf(b.level));
}

/** Adds a language you know, or changes how well you know it. Names match in any case. */
export async function setYourLanguage(db: Kysely<Database>, input: { name: string; level: string }): Promise<YourLanguage> {
	const name = input.name.trim().replace(/\s+/g, ' ');
	if (name === '') throw new InvalidYourLanguage('Name the language.');
	if (!(YOUR_LANGUAGE_LEVELS as readonly string[]).includes(input.level)) throw new InvalidYourLanguage('How well: native, fluent or some.');
	const level = input.level as YourLanguageLevel;
	const existing = (await listYourLanguages(db)).find((l) => l.name.toLowerCase() === name.toLowerCase());
	if (existing) {
		await db.updateTable('your_language').set({ level }).where('name', '=', existing.name).execute();
		return { name: existing.name, level };
	}
	await db.insertInto('your_language').values({ name, level, added_at: new Date().toISOString() }).execute();
	return { name, level };
}

export async function removeYourLanguage(db: Kysely<Database>, name: string): Promise<void> {
	const existing = (await listYourLanguages(db)).find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
	if (existing) await db.deleteFrom('your_language').where('name', '=', existing.name).execute();
}
