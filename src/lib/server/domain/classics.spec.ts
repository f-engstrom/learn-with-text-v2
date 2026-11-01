import { describe, it, expect } from 'vitest';
import { CLASSICS, classicUrl, findClassic, isTitleLine, wikisourceFromWeb, wikisourceText } from './classics';

/** The shape of a page from Wikisource's parse API: a header with notes, the work, its footnotes. */
const page = `<div class="mw-parser-output">
<div align="left"><small>更多资料：<a href="/wiki/x" class="mw-disambig">春</a></small></div>
<div class="ws-noexport" style="display:none"><span id="textquality" class="75%"></span></div>
<div id="headertemplate"><table class="headertemplate"><tr><td><span id="ws-title">Толстый и тонкий</span></td></tr></table>
<div class="ws-noexport" id="extra_nav"><ul><li>Другие редакции</li></ul></div></div>
Первая фраза стоит <b>без</b> абзаца.
<p>На вокзале встретились два приятеля:<sup class="reference"><a href="#cite_note-1">[1]</a></sup> один толстый,
другой тонкий.</p>
<p>&#8203;</p>
<p>* * *</p>
<div class="poem"><p>Вороне где-то бог послал кусочек сыру;<br>На ель Ворона взгромоздясь,</p></div>
<p>Izvor: Isaković, Alija (1990). Biserje.</p>
<div class="mw-heading mw-heading2"><h2 id="Примечания">Примечания</h2></div>
<div class="mw-references-wrap"><ol class="references"><li>Сноска.</li></ol></div>
<table class="licensetemplate"><tr><td>Public domain</td></tr></table>
<div class="licenseContainer"><p>Это произведение находится в общественном достоянии.</p></div>
</div>`;

describe('wikisourceText', () => {
	it("keeps the work's paragraphs, loose text and lines of verse, without Wikisource's header, notes, licence and footnote marks", () => {
		expect(wikisourceText(page).split('\n')).toEqual([
			'Первая фраза стоит без абзаца.',
			'На вокзале встретились два приятеля: один толстый, другой тонкий.',
			'Вороне где-то бог послал кусочек сыру;',
			'На ель Ворона взгромоздясь,',
			'== Примечания =='
		]);
	});
});

describe('isTitleLine', () => {
	it('sees a title through numbering, spacing and Persian joiners', () => {
		expect(isTitleLine('I. Ворона и Лисица', 'Ворона и Лисица')).toBe(true);
		expect(isTitleLine('آینهٔ شکسته', 'آینه شکسته')).toBe(true);
		expect(isTitleLine('آبجی‌خانم', 'آبجی خانم')).toBe(true);
		expect(isTitleLine('Ворона и Лисица сидели', 'Ворона и Лисица')).toBe(false);
	});
});

describe('Classics', () => {
	it('are found by the address their Book keeps', () => {
		for (const [code, classics] of Object.entries(CLASSICS)) {
			for (const classic of classics) expect(findClassic(code, classicUrl(classic))).toBe(classic);
		}
		expect(classicUrl({ site: 'ru.wikisource.org', page: 'Ванька (Чехов)' })).toBe(
			'https://ru.wikisource.org/wiki/%D0%92%D0%B0%D0%BD%D1%8C%D0%BA%D0%B0_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)'
		);
	});

	it('are fetched once, in Simplified Chinese where Wikisource mixes scripts', async () => {
		const asked: URL[] = [];
		const source = wikisourceFromWeb(async (input) => {
			asked.push(new URL(String(input)));
			return Response.json({ parse: { text: '<p>我与父亲不相见已二年余了。</p>' } });
		});
		const classic = { title: '背影', author: '朱自清', site: 'zh.wikisource.org', page: '背影' };
		expect(await source.text(classic)).toBe('我与父亲不相见已二年余了。');
		expect(await source.text(classic)).toBe('我与父亲不相见已二年余了。');
		expect(asked).toHaveLength(1);
		expect(asked[0].searchParams.get('page')).toBe('背影');
		expect(asked[0].searchParams.get('variant')).toBe('zh-hans');
	});
});
