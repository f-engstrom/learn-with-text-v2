// How the browser saves Terms: the Term form's fields, which the form writes and the server reads, and
// a Status on its own (a Status key, a suggestion, the Term list). Shared with the browser.
import type { SaveTerm } from '#lib/server/domain/terms.ts';

/** The Term form's field names. Translations are three parallel lists, one entry per row. */
export const termFields = {
	languageId: 'languageId',
	text: 'text',
	status: 'status',
	translationId: 'translationId',
	translationSource: 'translationSource',
	translationText: 'translationText',
	pronunciation: 'pronunciation',
	parent: 'parent',
	followsParent: 'followsParent',
	/** Present when the form shows the Origin; without it the Origin is kept as it is. */
	origin: 'origin',
	/** The Origin's links are three parallel lists, one entry per row. */
	originKind: 'originKind',
	originLanguage: 'originLanguage',
	originWord: 'originWord',
	originNote: 'originNote',
	originSource: 'originSource',
	/** The Term to delete. */
	id: 'id'
} as const;

/** What the Term form sent, as a Term to save. */
export function readTermForm(form: FormData): SaveTerm {
	const f = termFields;
	const ids = form.getAll(f.translationId).map(String);
	const sources = form.getAll(f.translationSource).map(String);
	return {
		languageId: Number(form.get(f.languageId)),
		text: String(form.get(f.text) ?? ''),
		status: String(form.get(f.status) ?? ''),
		pronunciation: String(form.get(f.pronunciation) ?? ''),
		parent: String(form.get(f.parent) ?? ''),
		followsParent: form.get(f.followsParent) === 'on',
		translations: form.getAll(f.translationText).map((text, i) => ({
			id: ids[i] ? Number(ids[i]) : undefined,
			text: String(text),
			source: sources[i]
		})),
		...(form.has(f.origin) ? { origin: readOrigin(form) } : {})
	};
}

function readOrigin(form: FormData): NonNullable<SaveTerm['origin']> {
	const f = termFields;
	const languages = form.getAll(f.originLanguage).map(String);
	const words = form.getAll(f.originWord).map(String);
	return {
		links: form.getAll(f.originKind).map((kind, i) => ({ kind: String(kind), language: languages[i] ?? '', word: words[i] ?? '' })),
		note: String(form.get(f.originNote) ?? ''),
		source: String(form.get(f.originSource) ?? 'you')
	};
}

/** Sets only a Status, creating the Term for an Unknown Word; resolves to why it was refused, if it was. */
export async function sendStatus(languageId: number, text: string, status: string): Promise<string | undefined> {
	const response = await fetch('/terms/status', {
		method: 'PUT',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({ languageId, text, status })
	}).catch(() => undefined);
	if (response?.ok) return undefined;
	const body = await response?.json().catch(() => undefined);
	return String(body?.message ?? 'Could not save the Status.');
}
