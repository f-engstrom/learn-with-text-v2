import { parseHTML } from 'linkedom';

/** A short, well-known public-domain work, read from a page on a Wikisource. */
export interface Classic {
	title: string;
	author: string;
	site: string;
	page: string;
}

/** The Wikisource seam: the real one fetches from wikisource.org, tests use a fake. */
export interface WikisourceSource {
	/** The work's text, with `== Heading ==` lines; undefined when the page is gone. */
	text(classic: Classic): Promise<string | undefined>;
}

/** The Classics for each Language, by code. */
export const CLASSICS: Record<string, Classic[]> = {
	// Russian
	ru: [
		{ title: 'Толстый и тонкий', author: 'Антон Чехов', site: 'ru.wikisource.org', page: 'Толстый и тонкий (Чехов)/ПСС 1975' },
		{ title: 'Хамелеон', author: 'Антон Чехов', site: 'ru.wikisource.org', page: 'Хамелеон (Чехов)/Вариант ПСС Чехова 1974—1982' },
		{ title: 'Злоумышленник', author: 'Антон Чехов', site: 'ru.wikisource.org', page: 'Злоумышленник (Чехов)' },
		{ title: 'Лошадиная фамилия', author: 'Антон Чехов', site: 'ru.wikisource.org', page: 'Лошадиная фамилия (Чехов)' },
		{ title: 'Ванька', author: 'Антон Чехов', site: 'ru.wikisource.org', page: 'Ванька (Чехов, 1886)' },
		{ title: 'Смерть чиновника', author: 'Антон Чехов', site: 'ru.wikisource.org', page: 'Смерть чиновника (Чехов)' },
		{ title: 'Филипок', author: 'Лев Толстой', site: 'ru.wikisource.org', page: 'Филипок (Толстой)' },
		{ title: 'Прыжок', author: 'Лев Толстой', site: 'ru.wikisource.org', page: 'Прыжок (Толстой)' },
		{ title: 'Лев и собачка', author: 'Лев Толстой', site: 'ru.wikisource.org', page: 'Лев и собачка (Толстой)' },
		{ title: 'Воробей', author: 'Иван Тургенев', site: 'ru.wikisource.org', page: 'Воробей (Тургенев)' },
		{ title: 'Ворона и Лисица', author: 'Иван Крылов', site: 'ru.wikisource.org', page: 'Ворона и Лисица (Крылов)' },
		{ title: 'Гробовщик', author: 'Александр Пушкин', site: 'ru.wikisource.org', page: 'Повести покойного Ивана Петровича Белкина (Пушкин)/Гробовщик' }
	],
	// Bosnian: bs.wikisource is mostly verse; prose comes from hr.wikisource too.
	bs: [
		{ title: 'Hasanaginica', author: 'narodna balada', site: 'bs.wikisource.org', page: 'Hasanaginica' },
		{ title: 'Smrt braće Morića', author: 'narodna pjesma', site: 'bs.wikisource.org', page: 'Smrt braće Morića' },
		{ title: 'Đerzelez Alija', author: 'narodna pjesma', site: 'bs.wikisource.org', page: 'Đerzelez Alija' },
		{ title: 'Mahzar bosanske fukare Visokoj Porti', author: 'narodna pjesma', site: 'bs.wikisource.org', page: 'Mahzar bosanske fukare Visokoj Porti' },
		{ title: 'Emina', author: 'Aleksa Šantić', site: 'bs.wikisource.org', page: 'Emina (Šantić)' },
		{ title: 'Lijepa je Hana', author: 'Aleksa Šantić', site: 'bs.wikisource.org', page: 'Lijepa je Hana' },
		{ title: 'Ostajte ovdje', author: 'Aleksa Šantić', site: 'bs.wikisource.org', page: 'Ostajte ovdje...' },
		{ title: 'Na grobu ljubavi', author: 'Aleksa Šantić', site: 'bs.wikisource.org', page: 'Na grobu ljubavi' },
		{ title: 'Gazel o Mostaru', author: 'Safvet-beg Bašagić', site: 'bs.wikisource.org', page: 'Gazel o Mostaru' },
		{ title: 'Jazavac i lisica', author: 'narodna pripovijetka', site: 'hr.wikisource.org', page: 'Jazavac i lisica' },
		{ title: 'Kip domovine leta 188*', author: 'Antun Gustav Matoš', site: 'hr.wikisource.org', page: 'Kip domovine leta 188*' },
		{ title: 'Vrabac', author: 'Antun Gustav Matoš', site: 'hr.wikisource.org', page: 'Vrabac' }
	],
	// Farsi
	fa: [
		{ title: 'مادلن', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'زنده بگور/مادلن' },
		{ title: 'اسیر فرانسوی', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'زنده بگور/اسیر فرانسوی' },
		{ title: 'آتش‌پرست', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'زنده بگور/آتش‌پرست' },
		{ title: 'داود گوژپشت', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'زنده بگور/داود گوژپشت' },
		{ title: 'آینه شکسته', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'سه قطره خون/آینه شکسته' },
		{ title: 'حاجی مراد', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'زنده بگور/حاجی مراد' },
		{ title: 'آبجی خانم', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'زنده بگور/آبجی خانم' },
		{ title: 'سگ ولگرد', author: 'صادق هدایت', site: 'fa.wikisource.org', page: 'سگ ولگرد (داستان کوتاه)' },
		{ title: 'چرند و پرند (شماره ۱)', author: 'علی‌اکبر دهخدا', site: 'fa.wikisource.org', page: 'چرند و پرند/از شماره ۱ دوره اول روزنامه صور اسرافیل' },
		{ title: 'چرند و پرند (شماره ۲)', author: 'علی‌اکبر دهخدا', site: 'fa.wikisource.org', page: 'چرند و پرند/از شماره ۲ دوره اول روزنامه صور اسرافیل' }
	],
	// Chinese: Wikisource keeps Traditional pages; they are read in Simplified.
	zh: [
		{ title: '孔乙己', author: '鲁迅', site: 'zh.wikisource.org', page: '孔乙己' },
		{ title: '一件小事', author: '鲁迅', site: 'zh.wikisource.org', page: '一件小事' },
		{ title: '故乡', author: '鲁迅', site: 'zh.wikisource.org', page: '故鄉' },
		{ title: '风筝', author: '鲁迅', site: 'zh.wikisource.org', page: '風箏' },
		{ title: '秋夜', author: '鲁迅', site: 'zh.wikisource.org', page: '秋夜 (魯迅)' },
		{ title: '从百草园到三味书屋', author: '鲁迅', site: 'zh.wikisource.org', page: '從百草園到三味書屋' },
		{ title: '藤野先生', author: '鲁迅', site: 'zh.wikisource.org', page: '藤野先生' },
		{ title: '背影', author: '朱自清', site: 'zh.wikisource.org', page: '背影' },
		{ title: '匆匆', author: '朱自清', site: 'zh.wikisource.org', page: '匆匆' },
		{ title: '春', author: '朱自清', site: 'zh.wikisource.org', page: '春 (朱自清)' },
		{ title: '荷塘月色', author: '朱自清', site: 'zh.wikisource.org', page: '荷塘月色' },
		{ title: '落花生', author: '许地山', site: 'zh.wikisource.org', page: '落花生' }
	]
};

/** The web address a Classic is read from, which its Book keeps. */
export const classicUrl = (c: Pick<Classic, 'site' | 'page'>) => `https://${c.site}/wiki/${encodeURI(c.page.replaceAll(' ', '_'))}`;

export const findClassic = (languageCode: string, url: string) => CLASSICS[languageCode]?.find((c) => classicUrl(c) === url);

/** Wikisource's own parts of a page: the header, notes on editions, licence, footnote marks and lists. */
const NOT_THE_WORK =
	'style, script, table, sup, #headertemplate, .ws-noexport, .noprint, .licensetemplate, .licenseContainer, .reference, .references, .mw-references-wrap, .mw-editsection, .mw-empty-elt, .sisitem';
const BLOCKS = 'p, h2, h3, h4, li, blockquote, dd, dt';
/** Elements that hold blocks; anything else in them is part of a paragraph. */
const CONTAINERS = /^(BODY|DIV|SECTION|CENTER)$/;
/** Where a line break was, kept apart from the newlines the page's source happens to have. */
const BREAK = ' ';

/** Runs of text standing loose in a container, outside any paragraph, become paragraphs of their own. */
function wrapLooseText(container: Element) {
	let run: Node[] = [];
	const wrap = () => {
		if (run.some((n) => /\p{L}/u.test(n.textContent ?? ''))) {
			const p = container.ownerDocument.createElement('p');
			container.insertBefore(p, run[0]);
			p.append(...run);
		}
		run = [];
	};
	for (const node of [...container.childNodes]) {
		const el = node.nodeType === 1 ? (node as Element) : undefined;
		if (el && (CONTAINERS.test(el.tagName) || el.matches(BLOCKS) || el.querySelector(BLOCKS))) {
			wrap();
			if (CONTAINERS.test(el.tagName)) wrapLooseText(el);
		} else if (el || node.nodeType === 3) run.push(node);
	}
	wrap();
}

/** The work's text from a Wikisource page's HTML: a paragraph (or line of verse) per line, headings as `== Heading ==`. */
export function wikisourceText(html: string): string {
	const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
	for (const el of [...document.querySelectorAll(NOT_THE_WORK)]) el.remove();
	// A note pointing to other works of the same name.
	for (const link of [...document.querySelectorAll('a.mw-disambig')]) link.closest('small, div')?.remove();
	// Lines of verse are kept apart.
	for (const br of [...document.querySelectorAll('br')]) br.replaceWith(BREAK);
	wrapLooseText(document.body);
	return [...document.querySelectorAll(BLOCKS)]
		.filter((el) => !el.querySelector(BLOCKS))
		.flatMap((el) => {
			const lines = (el.textContent ?? '').split(BREAK).map((line) => line.replace(/[\s​]+/g, ' ').trim());
			return /^H\d$/.test(el.tagName) ? [`== ${lines.join(' ').trim()} ==`] : lines;
		})
		// Lines without letters (asterisks between parts, page numbers) aren't reading, nor is a line naming the source.
		.filter((line) => /\p{L}/u.test(line) && !SOURCE_LINE.test(line))
		.join('\n');
}

const SOURCE_LINE = /^(izvor|источник|source|منبع|来源|出处)\s*[:：]/i;

/** Whether a line is only the work's title, as a page often begins: "I. Ворона и Лисица", "آینهٔ شکسته". */
export function isTitleLine(line: string, title: string): boolean {
	const key = (s: string) => s.replace(/^[IVXLC]+\.\s*/, '').replace(/[\s\u200c\u0654]/g, '');
	return key(line) === key(title);
}

const USER_AGENT = 'Reader/0.1 (personal language-learning app; Suggestions)';
/** Wikisources that mix scripts; their text is converted to one. */
const variants: Record<string, string> = { 'zh.wikisource.org': 'zh-hans' };

/** Fetches from Wikisource's API, keeping texts in memory: the list is short and the works don't change. */
export function wikisourceFromWeb(fetchFn: typeof fetch = fetch): WikisourceSource {
	const texts = new Map<string, Promise<string | undefined>>();
	return {
		text(classic) {
			const key = classicUrl(classic);
			let hit = texts.get(key);
			if (!hit) {
				const query = new URLSearchParams({
					action: 'parse',
					format: 'json',
					formatversion: '2',
					prop: 'text',
					redirects: '1',
					disableeditsection: '1',
					page: classic.page
				});
				if (variants[classic.site]) query.set('variant', variants[classic.site]);
				hit = fetchFn(`https://${classic.site}/w/api.php?${query}`, {
					headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
				}).then(async (response) => {
					if (!response.ok) throw new Error(`Wikisource answered ${response.status}`);
					const body = await response.json();
					return body.parse?.text ? wikisourceText(body.parse.text) : undefined;
				});
				hit.catch(() => texts.delete(key));
				texts.set(key, hit);
			}
			return hit;
		}
	};
}
