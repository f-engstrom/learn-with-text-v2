/**
 * Chapters (ADR 0009): a mark on the Page that starts one, with its title. A Chapter runs to the
 * next mark; Pages before the first mark are in none. Chapters don't nest.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { CHAPTER_LINE, chapterLabel, cleanChapterTitle } from '../../chapters';
import { countWords, type Parser } from './parsing';

export interface Chapter {
	/** 1-based, in the Book's order. */
	number: number;
	/** As stored; empty when it has none. */
	title: string;
	/** Its title, or "Chapter n". */
	label: string;
	/** Positions of its first and last Page. */
	first: number;
	last: number;
	/** How many of its Pages are Read. */
	read: number;
}

/** Where a Page is within its Chapter. */
export interface ChapterPlace {
	number: number;
	label: string;
	/** 1-based Page within the Chapter, and how many it has. */
	page: number;
	pages: number;
}

/** A Book's Chapters in order; empty when it has no marks. */
export async function listChapters(db: Kysely<Database>, bookId: number): Promise<Chapter[]> {
	const pages = await db.selectFrom('page').select(['position', 'chapter', 'read_at']).where('book_id', '=', bookId).orderBy('position').execute();
	return chaptersOf(pages.map((p) => ({ position: p.position, chapter: p.chapter, read: p.read_at !== null })));
}

/** The Chapters that marks on these Pages (in order) make. */
export function chaptersOf(pages: { position: number; chapter: string | null; read: boolean }[]): Chapter[] {
	const chapters: Chapter[] = [];
	for (const page of pages) {
		if (page.chapter !== null) {
			const number = chapters.length + 1;
			chapters.push({ number, title: page.chapter, label: chapterLabel(page.chapter, number), first: page.position, last: page.position, read: 0 });
		}
		const current = chapters.at(-1);
		if (!current) continue;
		current.last = page.position;
		if (page.read) current.read++;
	}
	return chapters;
}

/** The Chapter a Page is in, and where in it; undefined before the first mark. */
export function chapterAt(chapters: Chapter[], position: number): ChapterPlace | undefined {
	const chapter = chapters.findLast((c) => c.first <= position);
	if (!chapter || position > chapter.last) return undefined;
	return { number: chapter.number, label: chapter.label, page: position - chapter.first + 1, pages: chapter.last - chapter.first + 1 };
}

/** One Page of a Book being created: its text, and the title of the Chapter it starts, if any. */
export interface NewPage {
	text: string;
	chapter: string | null;
}

/**
 * Cuts a text at its `# ` lines into Chapters, each one's text then into Pages by `split`. The
 * heading line stays as the first line of its Chapter's first Page, without the `#`.
 */
export function splitIntoChapters(text: string, split: (text: string) => string[]): NewPage[] {
	const sections: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];
	let heading = false;
	for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
		const match = CHAPTER_LINE.exec(line);
		if (match && heading) {
			const section = sections.at(-1)!;
			const joiner = /[.:;,—–-]$/u.test(section.title!) ? ' ' : ' · ';
			section.title = cleanChapterTitle(`${section.title}${joiner}${match[1]}`);
			section.lines.push(match[1]);
		} else if (match) {
			sections.push({ title: cleanChapterTitle(match[1]), lines: [match[1]] });
		} else {
			sections.at(-1)!.lines.push(line);
		}
		heading = match !== null;
	}
	return sections.flatMap((section) => split(section.lines.join('\n')).map((page, i) => ({ text: page, chapter: i === 0 ? section.title : null })));
}

/** Words that start a Chapter's heading, in the Languages the Reader has, lower case. */
const CHAPTER_WORDS = [
	'chapter', 'part', 'book', 'глава', 'часть', 'книга', 'розділ', 'частина', 'kapitel', 'teil', 'buch', 'chapitre', 'partie', 'livre',
	'capítulo', 'capitulo', 'parte', 'libro', 'capitolo', 'hoofdstuk', 'deel', 'kapittel', 'kapitola', 'rozdział', 'część',
	'bab', 'bagian', 'kreu', 'pjesa', 'luku', 'fejezet', 'bölüm', 'κεφάλαιο'
];
const NUMBER = String.raw`(?:\d{1,3}|[\p{L}]+)`;
/** "Chapter 3", "ГЛАВА ПЕРВАЯ", "Capítulo IV. El baile". */
const WORD_HEADING = new RegExp(String.raw`^(?:${CHAPTER_WORDS.join('|')})\s+${NUMBER}\.?(?:\s*[.:—–-]\s*\S.*)?$`, 'iu');
/** "IV", "IV.", "IV. The Ball"; only capitals, so "mix" and "civil" aren't numerals. */
const ROMAN_HEADING = /^[IVXLC]+\.?(?:\s*[.:—–-]\s*\S.*)?$/u;
/** "第三章", "第3回". */
const CJK_HEADING = /^第[0-9一二三四五六七八九十百千零〇两]+[章回节節話话部卷].{0,30}$/u;
/** A heading is short; a longer line is prose that happens to start like one. */
const MAX_HEADING_CHARS = 80;
/** A Chapter shorter than this is a table of contents or a Part's heading over its first Chapter. */
export const MIN_CHAPTER_WORDS = 30;

function isHeading(line: string): boolean {
	const text = line.trim();
	return text !== '' && text.length <= MAX_HEADING_CHARS && (WORD_HEADING.test(text) || ROMAN_HEADING.test(text) || CJK_HEADING.test(text));
}

/** A line that could be a heading's subtitle: short, and not ending as a Sentence would. */
function isSubtitle(line: string): boolean {
	const text = line.trim();
	return text !== '' && text.length <= 60 && !/[.!?…,;:»"”]$/u.test(text) && !isHeading(text);
}

/**
 * Marks the Chapter headings found in a plain text as `# ` lines, for `splitIntoChapters`. A text
 * that already has `# ` lines is left as it is. Headings are lines like "Chapter 3", "Глава 3",
 * "IV" or "第三章", with the short line straight after one as its subtitle. Found headings are
 * kept only when there are two or more, each over at least MIN_CHAPTER_WORDS Words.
 */
export function detectChapters(text: string, parser: Parser): string {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	if (lines.some((l) => CHAPTER_LINE.test(l))) return text;
	const candidates = lines.flatMap((line, i) => (isHeading(line) ? [i] : []));
	const words = (from: number, to: number) => countWords(parser.parse(lines.slice(from, to).join('\n')));
	const kept = candidates.filter((at, k) => words(at + 1, candidates[k + 1] ?? lines.length) >= MIN_CHAPTER_WORDS);
	if (kept.length < 2) return text;
	const marked = new Set(kept);
	for (const at of kept) {
		if (at + 1 < lines.length && isSubtitle(lines[at + 1])) marked.add(at + 1);
	}
	return lines.map((line, i) => (marked.has(i) ? `# ${line.trim()}` : line)).join('\n');
}
