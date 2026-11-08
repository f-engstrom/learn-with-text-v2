// Shared with the browser: the screens that grade Reviews send them here.
import type { Grade, ReviewSource } from '#lib/server/domain/practice.ts';

/** Sends a Review of a Term; resolves to why it was refused, if it was. */
export async function sendReview(termId: number, grade: Grade, source: ReviewSource): Promise<string | undefined> {
	const response = await fetch(`/terms/${termId}/reviews`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({ grade, source })
	}).catch(() => undefined);
	if (response?.ok) return undefined;
	const body = await response?.json().catch(() => undefined);
	return String(body?.message ?? 'Could not save the Review.');
}
