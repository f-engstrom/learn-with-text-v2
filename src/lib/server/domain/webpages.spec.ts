import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { decodePage, extractArticle, fetchArticle, InvalidAddress } from './webpages';

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
const html = (name: string, contentType: string | null = null) => decodePage(fixture(name), contentType);

/** What every fixture's menus, ads, related links, comments and footer have in common. */
const boilerplate = ['Advertisement', '©', 'cookie', 'Cookie', 'OK', '(3)'];

describe('extractArticle', () => {
	const cases = [
		{
			name: 'ru-windows-1251.html',
			title: 'Как город учится читать',
			first: 'В городской библиотеке открылся клуб для тех, кто хочет снова полюбить чтение.',
			last: 'Библиотека планирует открыть такие же встречи для детей и для тех, кто изучает русский язык как иностранный.',
			absent: ['Главная', 'Читайте также', 'Отличная идея', 'Все права']
		},
		{
			name: 'fa.html',
			title: 'کتابخانه‌ای در کوچه',
			first: 'ساکنان یک کوچه در شهر تصمیم گرفتند کتاب‌هایشان را با همسایه‌ها شریک شوند.',
			last: 'در چند هفتهٔ گذشته، کوچه‌های دیگر هم از این ایده استقبال کرده‌اند و قفسه‌های تازه‌ای ساخته‌اند.',
			absent: ['صفحه اصلی', 'مطالب مرتبط', 'چه ایدهٔ قشنگی', 'حقوق محفوظ']
		},
		{
			name: 'zh.html',
			title: '城市里的读书会',
			first: '每个周末，一家小书店都会为喜欢读书的人举办读书会。',
			last: '读书会还专门为学习中文的外国朋友准备了简单的读物，大家互相帮助，遇到不认识的字就一起查字典。',
			absent: ['首页', '相关阅读', '我也想参加', '版权所有']
		},
		{
			name: 'bs.html',
			title: 'Grad koji čita',
			first: 'U gradskoj biblioteci otvoren je klub za sve koji žele ponovo zavoljeti čitanje.',
			last: 'Biblioteka planira otvoriti slične susrete za djecu i za one koji uče bosanski kao strani jezik.',
			absent: ['Početna', 'Pročitajte još', 'Odlična ideja', 'Sva prava']
		}
	];

	for (const c of cases) {
		it(`keeps only the article of ${c.name}, one paragraph per line`, () => {
			const article = extractArticle(html(c.name), 'https://news.example/story')!;
			expect(article.title).toBe(c.title);
			const lines = article.text.split('\n');
			expect(lines[0]).toBe(c.first);
			expect(lines.at(-1)).toBe(c.last);
			for (const text of [...c.absent, ...boilerplate]) expect(article.text).not.toContain(text);
		});
	}

	it('finds nothing on a page without an article', () => {
		expect(extractArticle('<html><body><nav><a href="/">Home</a></nav></body></html>', 'https://x.example/')).toBeUndefined();
	});
});

describe('decodePage', () => {
	it("uses the charset from the headers, then the page's meta tag, then UTF-8", () => {
		expect(html('ru-windows-1251.html')).toContain('Как город учится читать');
		expect(decodePage(new TextEncoder().encode('<p>Кот</p>'), 'text/html; charset=utf-8')).toBe('<p>Кот</p>');
		expect(decodePage(new TextEncoder().encode('<p>Кот</p>'), null)).toBe('<p>Кот</p>');
	});
});

describe('fetchArticle', () => {
	const serve = (body: Uint8Array | string, init: ResponseInit = {}) =>
		(async () => new Response(body as BodyInit, { headers: { 'content-type': 'text/html' }, ...init })) as unknown as typeof fetch;

	it('fetches a page and returns its address, title and text', async () => {
		const article = await fetchArticle(' https://news.example/fa ', serve(fixture('fa.html')));
		expect(article).toMatchObject({ url: 'https://news.example/fa', title: 'کتابخانه‌ای در کوچه' });
	});

	it('explains what went wrong', async () => {
		await expect(fetchArticle('news.example/story', serve(''))).rejects.toThrow('not a web address');
		await expect(fetchArticle('ftp://news.example/', serve(''))).rejects.toThrow(InvalidAddress);
		await expect(fetchArticle('https://news.example/', serve('', { status: 404 }))).rejects.toThrow('answered 404');
		await expect(
			fetchArticle('https://news.example/a.pdf', serve('%PDF', { headers: { 'content-type': 'application/pdf' } }))
		).rejects.toThrow("isn't a web page");
		await expect(fetchArticle('https://news.example/', serve('<html><body>Hi</body></html>'))).rejects.toThrow("Couldn't find an article");
		const failing = (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
		await expect(fetchArticle('https://news.example/', failing)).rejects.toThrow("Couldn't reach");
	});
});
