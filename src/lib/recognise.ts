// Recognise (ADR 0010): text read from photos and PDFs, one photo or PDF page at a time. Shared with
// the browser, which appends each photo's text to the box as it comes back, in the order they were taken.

/** What the photo picker and the Tutor's `recognise_files` accept. */
export const RECOGNISABLE = '.txt,text/plain,.pdf,application/pdf,image/*,.heic,.heif';

/**
 * Joins the text of the next photo (or page) to what came before. A Word hyphenated across them is
 * mended, a Sentence that runs on stays one paragraph, and anything else starts a new one.
 */
export function appendRecognised(text: string, next: string): string {
	const before = text.trimEnd();
	const after = next.trim();
	if (before === '') return after;
	if (after === '') return before;
	if (/\p{L}-$/u.test(before) && /^\p{Ll}/u.test(after)) return before.slice(0, -1) + after;
	const runsOn = /^\p{Ll}/u.test(after) || !/[.!?…:;»"”)\]]$/u.test(before);
	return before + (runsOn ? ' ' : '\n') + after;
}
