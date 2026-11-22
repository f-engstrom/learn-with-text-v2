import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { appendRecognised } from '../../recognise';
import type { Language } from './languages';
import { Refused } from './refused';
import { textFromFile } from './books';

// Recognise (ADR 0010): the text in photos and PDFs, read by the Mac helper (`native/recognise`,
// Apple's Vision and PDFKit) and cleaned up here. The clean-up is a set of rules over the lines the
// helper returns, each shown on photos of real Pages in `recognise.spec.ts`.

export class CannotRecognise extends Refused {}

/** A line Vision read: its box from 0 to 1, origin top-left, and the height of its two ends. */
export interface RecognisedLine {
	text: string;
	confidence: number;
	x: number;
	y: number;
	width: number;
	height: number;
	leftY: number;
	rightY: number;
}

/** One photo, or one page of a PDF: its own text (a PDF that has some) or the lines Vision read. */
export interface RecognisedPage {
	file: string;
	text?: string;
	lines?: RecognisedLine[];
}

/** Reads files on this computer in a Language. */
export type ReadFiles = (paths: string[], language: Pick<Language, 'code' | 'name'>) => Promise<RecognisedPage[]>;

export const MAX_RECOGNISE_BYTES = 100 * 1024 * 1024;

const PHOTO = /^\.(heic|heif|jpe?g|png|tiff?|gif|bmp|webp)$/i;

/** The text in files on this computer (photos, PDFs, text files), in order, joined as one text. */
export async function recogniseFiles(read: ReadFiles, language: Pick<Language, 'code' | 'name'>, paths: string[]): Promise<string> {
	if (paths.length === 0) throw new CannotRecognise('Choose a photo, a PDF or a text file.');
	let text = '';
	// Runs of photos and PDFs go to the helper together; a text file is read as it is.
	let batch: string[] = [];
	const flush = async () => {
		if (batch.length === 0) return;
		for (const page of await read(batch, language)) text = appendRecognised(text, textOfPage(page));
		batch = [];
	};
	for (const path of paths) {
		const extension = extname(path).toLowerCase();
		if (extension === '.txt') {
			await flush();
			text = appendRecognised(text, textFromFile(await readFile(path)));
		} else if (extension === '.pdf' || PHOTO.test(extension)) {
			batch.push(path);
		} else {
			throw new CannotRecognise(`${basename(path)} isn't a photo, a PDF or a text file.`);
		}
	}
	await flush();
	if (text.trim() === '') throw new CannotRecognise('No text was found.');
	return text;
}

/** The text in uploaded files, kept only while they are read. */
export async function recogniseUploads(
	read: ReadFiles,
	language: Pick<Language, 'code' | 'name'>,
	files: { name: string; bytes: Uint8Array }[]
): Promise<string> {
	for (const file of files) {
		if (file.bytes.length > MAX_RECOGNISE_BYTES) throw new CannotRecognise(`${file.name} is larger than 100 MB.`);
	}
	const folder = await mkdtemp(join(tmpdir(), 'reader-recognise-'));
	try {
		const paths = await Promise.all(
			files.map(async (file, i) => {
				// Each in a folder of its own, under its own name: the helper tells a PDF by its extension,
				// and a refusal names the file as the learner knows it.
				await mkdir(join(folder, String(i)));
				const path = join(folder, String(i), basename(file.name) || 'file');
				await writeFile(path, file.bytes);
				return path;
			})
		);
		return await recogniseFiles(read, language, paths);
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

/**
 * A photo as a JPEG at most `size` pixels on its longer side, for a browser that can't show it as it
 * is (an iPhone's HEIC shows only in Safari). Made by macOS's `sips`; the photo isn't kept.
 */
export async function photoPreview(file: { name: string; bytes: Uint8Array }, size = 1600): Promise<Uint8Array> {
	if (!PHOTO.test(extname(file.name))) throw new CannotRecognise(`${basename(file.name)} isn't a photo.`);
	if (file.bytes.length > MAX_RECOGNISE_BYTES) throw new CannotRecognise(`${file.name} is larger than 100 MB.`);
	const folder = await mkdtemp(join(tmpdir(), 'reader-preview-'));
	try {
		const photo = join(folder, `photo${extname(file.name).toLowerCase()}`);
		const preview = join(folder, 'preview.jpg');
		await writeFile(photo, file.bytes);
		await new Promise<void>((done, failed) =>
			execFile('sips', ['-s', 'format', 'jpeg', '-Z', String(size), photo, '--out', preview], (error) =>
				error ? failed(new CannotRecognise(`${basename(file.name)} can't be shown.`)) : done()
			)
		);
		return new Uint8Array(await readFile(preview));
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

/**
 * Vision's readers for Languages it has none of its own for, where another reads every letter: tried
 * on sample text, which came back exactly. Bosnian (č ć š ž lost) and Albanian (about half of ë lost)
 * are left out, since a misread letter makes another Word (ADR 0010).
 */
const VISION_STAND_INS: Record<string, string> = { id: 'en-US' };

/** The Language code the helper reads in: the Language's own, or a stand-in's. */
export const visionLanguage = (code: string) => VISION_STAND_INS[code] ?? code;

/**
 * The Mac helper, built by `pnpm build:native` into `bin/recognise`. Without it, recognising is
 * refused and pasting text still works.
 */
export function visionReader(helper = process.env.RECOGNISE_HELPER ?? resolve('bin/recognise')): ReadFiles {
	return (paths, language) =>
		new Promise((done, failed) => {
			execFile(helper, ['--language', visionLanguage(language.code), ...paths], { maxBuffer: 256 * 1024 * 1024 }, (error, stdout, stderr) => {
				if (!error) return done(JSON.parse(stdout));
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
					return failed(new CannotRecognise('Text recognition needs the Mac helper: run `pnpm build:native`.'));
				}
				// The helper's exit 2: Vision has no recogniser for the Language.
				if (error.code === 2) return failed(new CannotRecognise(`Text recognition can't read ${language.name}.`));
				const message = stderr.trim();
				failed(message ? new CannotRecognise(message) : error);
			});
		});
}

/** One photo's or PDF page's text, cleaned up: a paragraph to a line. */
export function textOfPage(page: RecognisedPage): string {
	if (page.text !== undefined) return page.text;
	return paragraphsOf(page.lines ?? [])
		.map((lines) => lines.map((l) => l.text.trim()).reduce(joinLines))
		.map(typesetDashes)
		.join('\n');
}

const median = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};

const right = (l: RecognisedLine) => l.x + l.width;

/**
 * The lines of the Page's text: a facing page's edge, a bookmark or a hand at the side are outside
 * the column the full lines make, and a page number stands alone above or below it.
 */
export function textLines(lines: RecognisedLine[]): RecognisedLine[] {
	const full = lines.filter((l) => l.width >= 0.5 * Math.max(...lines.map((m) => m.width)));
	const left = median(full.map((l) => l.x));
	const end = median(full.map(right));
	// A Paragraph's short last line ends just past the margin; the facing page's edge ends before it.
	const inColumn = lines.filter((l) => l.x < end - 0.03 && right(l) > left - 0.02 && l.text.trim() !== '');
	const ordered = [...inColumn].sort((a, b) => a.leftY - b.leftY);
	const isNumber = (l: RecognisedLine | undefined) => l !== undefined && /^\s*(\d{1,4}|[IVXLC]{1,6})\s*$/.test(l.text);
	if (isNumber(ordered.at(-1))) ordered.pop();
	if (isNumber(ordered[0])) ordered.shift();
	return ordered;
}

/**
 * The lines in reading order, a line Vision read as two pieces joined again. A tilted photo's lines
 * slope, so they are ordered by their left ends, and two pieces meet where one ends and the next starts.
 */
export function rows(lines: RecognisedLine[]): RecognisedLine[] {
	const gap = median(lines.slice(1).map((l, i) => l.leftY - lines[i].leftY)) || 0.02;
	const result: RecognisedLine[][] = [];
	for (const line of lines) {
		const row = result.at(-1);
		const before = row?.filter((l) => right(l) <= line.x + 0.02).sort((a, b) => right(b) - right(a))[0];
		const after = row?.filter((l) => l.x >= right(line) - 0.02).sort((a, b) => a.x - b.x)[0];
		const sameRow =
			row !== undefined &&
			row.every((l) => right(l) <= line.x + 0.02 || l.x >= right(line) - 0.02) &&
			((before !== undefined && Math.abs(before.rightY - line.leftY) < gap / 2) ||
				(after !== undefined && Math.abs(line.rightY - after.leftY) < gap / 2));
		if (sameRow) row.push(line);
		else result.push([line]);
	}
	return result.map((row) => {
		const pieces = row.sort((a, b) => a.x - b.x);
		if (pieces.length === 1) return pieces[0];
		const first = pieces[0];
		const last = pieces.at(-1)!;
		return {
			...first,
			text: pieces.map((l) => l.text.trim()).join(' '),
			width: right(last) - first.x,
			rightY: last.rightY,
			confidence: Math.min(...pieces.map((l) => l.confidence))
		};
	});
}

/**
 * The lines grouped into paragraphs. A paragraph starts after a gap wider than the lines' spacing,
 * or on an indented line that begins as one would (a capital, a dash, a quote, a number); never on
 * one that carries on a Word broken by a hyphen. The margin it is indented from is fitted along the
 * column, since a photo is rarely square to the page.
 */
export function paragraphsOf(lines: RecognisedLine[]): RecognisedLine[][] {
	const ordered = rows(textLines(lines));
	if (ordered.length === 0) return [];
	const margin = fitMargin(ordered);
	const width = median(ordered.map((l) => l.width));
	const indent = Math.max(0.02, width * 0.03);
	const spacing = median(ordered.slice(1).map((l, i) => l.leftY - ordered[i].leftY));
	const paragraphs: RecognisedLine[][] = [];
	ordered.forEach((line, i) => {
		const previous = ordered[i - 1];
		const opens = /^[\p{Lu}\p{N}«"„“'‘(\-–—•…]/u.test(line.text.trim());
		const starts =
			previous === undefined ||
			(!/\p{L}-$/u.test(previous.text.trim()) &&
				(line.leftY - previous.leftY > spacing * 1.8 || (line.x - margin(line.leftY) > indent && opens)));
		if (starts) paragraphs.push([line]);
		else paragraphs.at(-1)!.push(line);
	});
	return paragraphs;
}

/** The left margin along the page, x = a + b·y: fitted to the lines and refitted to those at or left of it, so indents don't pull it. */
function fitMargin(lines: RecognisedLine[]): (y: number) => number {
	let points = lines.map((l) => ({ x: l.x, y: l.leftY }));
	let fit = (y: number) => median(points.map((p) => p.x)) + 0 * y;
	for (let round = 0; round < 4 && points.length >= 2; round++) {
		const n = points.length;
		const my = points.reduce((s, p) => s + p.y, 0) / n;
		const mx = points.reduce((s, p) => s + p.x, 0) / n;
		const syy = points.reduce((s, p) => s + (p.y - my) ** 2, 0);
		const b = syy === 0 ? 0 : points.reduce((s, p) => s + (p.y - my) * (p.x - mx), 0) / syy;
		const a = mx - b * my;
		fit = (y: number) => a + b * y;
		const kept = lines.map((l) => ({ x: l.x, y: l.leftY })).filter((p) => p.x - fit(p.y) <= 0.01);
		if (kept.length < 2) break;
		points = kept;
	}
	return fit;
}

/** Two lines of one paragraph: a Word hyphenated at the line's end is joined again. */
export function joinLines(before: string, after: string): string {
	if (/\p{L}-$/u.test(before) && /^\p{Ll}/u.test(after)) return before.slice(0, -1) + after;
	return `${before} ${after}`;
}

/**
 * Vision reads a dash as a hyphen. One that opens a paragraph, or stands apart from the Words beside
 * it, is a dash; a hyphen inside a Word (`почему-то`) stays.
 */
export function typesetDashes(paragraph: string): string {
	return (
		paragraph
			// Opening a line of dialogue (Vision sometimes reads that dash as a bullet).
			.replace(/^(?:--|[-–—•])\s*/u, '— ')
			// Between spaces.
			.replace(/\s+(?:--|[-–—])\s+/gu, ' — ')
			// Straight after a comma or a full stop: `говорю,- Кирилл`.
			.replace(/([.,!?…;:])\s*(?:--|[-–—])\s*/gu, '$1 — ')
	);
}
