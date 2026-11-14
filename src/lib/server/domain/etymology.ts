import type { OriginKind, OriginLink } from './terms';

// Reads an Origin out of an English Wiktionary page's Etymology sections: its templates give the
// links, and the section as plain text gives the note. Offered in the Dictionary panel, never saved by itself.

/** One Etymology section as an Origin to offer: Wiktionary may have several for one spelling. */
export interface OriginSuggestion {
	/** The section's heading, e.g. 'Etymology 2'. */
	heading: string;
	links: OriginLink[];
	note?: string;
}

/** Wiktionary's codes for the languages words most often come from, and for the Reader's own. */
const names: Record<string, string> = {
	ar: 'Arabic', az: 'Azerbaijani', be: 'Belarusian', bg: 'Bulgarian', bs: 'Bosnian', ca: 'Catalan', cs: 'Czech', cu: 'Old Church Slavonic',
	cy: 'Welsh', da: 'Danish', de: 'German', dum: 'Middle Dutch', el: 'Greek', en: 'English', enm: 'Middle English', es: 'Spanish',
	et: 'Estonian', fa: 'Persian', fi: 'Finnish', fr: 'French', frm: 'Middle French', fro: 'Old French', ga: 'Irish', gem: 'Germanic',
	gmh: 'Middle High German', goh: 'Old High German', got: 'Gothic', grc: 'Ancient Greek', he: 'Hebrew', hi: 'Hindi', hr: 'Croatian',
	hu: 'Hungarian', hy: 'Armenian', id: 'Indonesian', is: 'Icelandic', it: 'Italian', ja: 'Japanese', ka: 'Georgian', kk: 'Kazakh',
	ko: 'Korean', la: 'Latin', 'la-lat': 'Late Latin', 'la-med': 'Medieval Latin', 'la-new': 'New Latin', 'la-vul': 'Vulgar Latin',
	lt: 'Lithuanian', lv: 'Latvian', ltc: 'Middle Chinese', mk: 'Macedonian', mn: 'Mongolian', ms: 'Malay', nl: 'Dutch',
	nb: 'Norwegian Bokmål', nn: 'Norwegian Nynorsk', no: 'Norwegian', non: 'Old Norse', och: 'Old Chinese', orv: 'Old East Slavic',
	ang: 'Old English', ota: 'Ottoman Turkish', pal: 'Middle Persian', peo: 'Old Persian', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian',
	ru: 'Russian', sa: 'Sanskrit', sh: 'Serbo-Croatian', sk: 'Slovak', sl: 'Slovene', sq: 'Albanian', sr: 'Serbian', sv: 'Swedish',
	sw: 'Swahili', syc: 'Classical Syriac', ta: 'Tamil', tr: 'Turkish', tt: 'Tatar', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek',
	vi: 'Vietnamese', yi: 'Yiddish', zh: 'Chinese', jv: 'Javanese', xcl: 'Old Armenian', akk: 'Akkadian',
	arc: 'Aramaic', egy: 'Egyptian', ine: 'Indo-European', sla: 'Slavic', bat: 'Baltic', itc: 'Italic', iir: 'Indo-Iranian',
	ira: 'Iranian', trk: 'Turkic', cel: 'Celtic', urj: 'Uralic', sit: 'Sino-Tibetan', map: 'Austronesian', poz: 'Malayo-Polynesian',
	sqj: 'Albanian', gmw: 'West Germanic', gmq: 'North Germanic', inc: 'Indo-Aryan', sem: 'Semitic', dra: 'Dravidian'
};

/** A Wiktionary language code in words: 'ota' → 'Ottoman Turkish', 'sla-pro' → 'Proto-Slavic'. */
export function languageName(code: string): string {
	const c = code.trim();
	if (names[c]) return names[c];
	const proto = c.match(/^(.+)-pro$/);
	if (proto && names[proto[1]]) return `Proto-${names[proto[1]]}`;
	return c;
}

/** The kind of link each template gives, and where its source language and word are among its arguments. */
const linkTemplates: Record<string, { kind: OriginKind; language: number; word: number }> = {};
const add = (kind: OriginKind, language: number, word: number, ...templates: string[]) =>
	templates.forEach((t) => (linkTemplates[t] = { kind, language, word }));
add('loanword', 2, 3, 'bor', 'bor+', 'borrowed', 'lbor', 'learned borrowing', 'slbor', 'obor', 'ubor', 'bor-lite');
add('inherited', 2, 3, 'inh', 'inh+', 'inherited', 'inh-lite');
add('derived', 2, 3, 'der', 'der+', 'derived', 'uder', 'der-lite');
add('calque', 2, 3, 'cal', 'cal+', 'calque', 'clq', 'pcal', 'partial calque', 'sl', 'semantic loan');
add('cognate', 1, 2, 'cog', 'cognate');

/** Words that open a template's text when it says what it is ("Borrowed from …"). */
const leads: Record<string, string> = {
	'bor+': 'Borrowed from ', 'inh+': 'Inherited from ', 'der+': 'Derived from ', 'cal+': 'Calque of ', lbor: 'Learned borrowing from ',
	'learned borrowing': 'Learned borrowing from ', calque: 'Calque of ', cal: 'Calque of ', pcal: 'Partial calque of ',
	'partial calque': 'Partial calque of ', sl: 'Semantic loan from ', 'semantic loan': 'Semantic loan from '
};

/**
 * The Etymology sections in a Language's part of a page's wikitext, as Origins to offer. The
 * `section` is Wiktionary's language heading, e.g. 'Russian' or 'Serbo-Croatian'.
 */
export function readEtymologies(wikitext: string, section: string): OriginSuggestion[] {
	const part = languageSection(wikitext, section);
	if (!part) return [];
	const suggestions: OriginSuggestion[] = [];
	const heading = /^(={3,5})\s*(Etymology(?:\s+\d+)?)\s*\1\s*$/gm;
	for (let match = heading.exec(part); match; match = heading.exec(part)) {
		const start = match.index + match[0].length;
		const next = part.slice(start).search(/^=+[^=].*=+\s*$/m);
		const body = next === -1 ? part.slice(start) : part.slice(start, start + next);
		const suggestion = readSection(match[2], body);
		if (suggestion.links.length > 0 || suggestion.note) suggestions.push(suggestion);
	}
	return suggestions;
}

/** A level-2 language section, up to the next one. */
function languageSection(wikitext: string, section: string): string | undefined {
	const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const start = wikitext.search(new RegExp(`^==\\s*${escaped}\\s*==\\s*$`, 'm'));
	if (start === -1) return undefined;
	const rest = wikitext.slice(start).replace(/^.*\n?/, '');
	const end = rest.search(/^==[^=].*[^=]==\s*$/m);
	return end === -1 ? rest : rest.slice(0, end);
}

function readSection(heading: string, body: string): OriginSuggestion {
	const links: OriginLink[] = [];
	const text = body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<ref[^>]*\/>/g, '')
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
	const note = plainWikitext(renderTemplates(text, links));
	const seen = new Set<string>();
	return {
		heading,
		links: links.filter((l) => {
			const key = `${l.kind}|${l.language}|${l.word}`;
			return !seen.has(key) && (seen.add(key), true);
		}),
		...(note ? { note } : {})
	};
}

/** Text with its templates rendered in reading order, so the links come out in the order they're written. */
function renderTemplates(text: string, links: OriginLink[]): string {
	let out = '';
	let i = 0;
	while (i < text.length) {
		const open = text.indexOf('{{', i);
		if (open === -1) break;
		// Find the matching close, counting templates opened inside this one.
		let depth = 0;
		let close = -1;
		for (let j = open; j < text.length - 1; j++) {
			if (text.startsWith('{{', j)) (depth++, j++);
			else if (text.startsWith('}}', j)) {
				depth--;
				j++;
				if (depth === 0) {
					close = j - 1;
					break;
				}
			}
		}
		if (close === -1) break;
		out += text.slice(i, open) + renderTemplate(renderTemplates(text.slice(open + 2, close), links), links);
		i = close + 2;
	}
	return out + text.slice(i);
}

/** A template as the text it shows, noting the link it gives, if any. */
function renderTemplate(inner: string, links: OriginLink[]): string {
	const [rawName, ...args] = inner.split('|');
	const name = rawName.trim();
	const positional = args.filter((a) => !/^\s*[\w-]+\s*=/.test(a)).map((a) => a.trim());
	const named = Object.fromEntries(
		args.filter((a) => /^\s*[\w-]+\s*=/.test(a)).map((a) => [a.slice(0, a.indexOf('=')).trim(), a.slice(a.indexOf('=') + 1).trim()])
	);
	const at = (n: number) => positional[n - 1] ?? '';
	const gloss = (n: number) => {
		const t = named.t ?? named.gloss ?? at(n);
		return t ? ` (“${t}”)` : '';
	};
	const shown = (word: string, alt?: string) => (alt || word).replace(/^-$/, '');

	const link = linkTemplates[name];
	if (link) {
		const language = languageName(at(link.language));
		const word = shown(at(link.word));
		if (language) links.push({ kind: link.kind, language, word: word.replace(/^\[\[|\]\]$/g, '') });
		const words = word ? ` ${shown(word, named.alt ?? at(link.word + 1))}` : '';
		return `${leads[name] ?? ''}${language}${words}${gloss(link.word + 2)}`;
	}
	switch (name) {
		case 'etymon':
			return renderEtymon(positional.slice(1), links);
		case 'm':
		case 'mention':
		case 'l':
		case 'll':
		case 'link':
			return `${shown(at(2), named.alt ?? at(3))}${gloss(4)}`;
		case 'etyl':
		case 'lang':
			return name === 'etyl' ? languageName(at(1)) : at(2);
		case 'noncog':
		case 'nc':
			return `${languageName(at(1))} ${shown(at(2))}${gloss(4)}`;
		case 'af':
		case 'affix':
		case 'compound':
		case 'com':
			return positional.slice(1).filter(Boolean).join(' + ');
		case 'prefix':
		case 'pre':
			return `${at(2)}- + ${at(3)}`;
		case 'suffix':
		case 'suf':
			return `${at(2)} + -${at(3).replace(/^-/, '')}`;
		case 'w':
		case 'pedia':
			return at(2) || at(1);
		case 'gloss':
		case 'gl':
		case 'q':
		case 'qualifier':
		case 'i':
			return `(${at(1)})`;
		case 'glossary':
			return at(2) || at(1);
		case 'unk':
		case 'unknown':
			return named.cap ? 'Unknown' : 'unknown';
		case 'unc':
		case 'uncertain':
			return named.cap ? 'Uncertain' : 'uncertain';
		case 'onom':
		case 'onomatopoeic':
			return named.cap ? 'Onomatopoeic' : 'onomatopoeic';
		default:
			// Root, request and date templates and the like say nothing worth keeping in a note.
			return '';
	}
}

const etymonKinds: Record<string, OriginKind> = { bor: 'loanword', lbor: 'loanword', slbor: 'loanword', obor: 'loanword', inh: 'inherited', der: 'derived', cal: 'calque', pcal: 'calque', sl: 'calque' };
const etymonLeads: Record<OriginKind, string> = { loanword: 'Borrowed from', inherited: 'Inherited from', derived: 'From', calque: 'Calque of', cognate: 'Compare' };

/**
 * Wiktionary's newer {{etymon}}: relations (':bor') each followed by the words they apply to
 * ('ar:كِتَاب<id:book>'), read as a chain.
 */
function renderEtymon(items: string[], links: OriginLink[]): string {
	let kind: OriginKind = 'derived';
	const parts: string[] = [];
	for (const item of items) {
		if (item.startsWith(':')) {
			kind = etymonKinds[item.slice(1)] ?? 'derived';
			continue;
		}
		const match = item.match(/^([\w-]+):([^<]+)/);
		if (!match) continue;
		const language = languageName(match[1]);
		const word = match[2].trim();
		links.push({ kind, language, word });
		parts.push(`${parts.length === 0 ? etymonLeads[kind] : 'from'} ${language} ${word}`);
	}
	return parts.join(', ');
}

const MAX_NOTE = 400;

/** Wikitext as plain text: links and emphasis unwrapped, a list as sentences, cut to a few sentences. */
function plainWikitext(text: string): string {
	const plain = text
		.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
		.replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, '$1')
		.replace(/'{2,}/g, '')
		.replace(/<[^>]+>/g, '')
		.replace(/^[*#:]+\s*/gm, '')
		.replace(/^-{4,}\s*$/gm, '')
		.replace(/\s+/g, ' ')
		.replace(/\(\s*\)/g, '')
		.replace(/(?<!\.)\.{2}(?!\.)/g, '.')
		.replace(/\s+([),;.:])/g, '$1')
		.replace(/^[\s,;.:]+/, '')
		.trim();
	if (plain.length <= MAX_NOTE) return plain;
	const cut = plain.slice(0, MAX_NOTE);
	const end = cut.lastIndexOf('. ');
	return end > MAX_NOTE / 3 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}
