import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appendRecognised } from '../../recognise';
import { CannotRecognise, joinLines, photoPreview, visionLanguage, recogniseFiles, recogniseUploads, textOfPage, typesetDashes, visionReader, type ReadFiles, type RecognisedPage } from './recognise';

// Each rule is shown on what Vision read from a photo of a real Page (recorded with
// `bin/recognise --language ru photo.heic`; the photos themselves aren't kept).
const photo = (name: string): RecognisedPage => JSON.parse(readFileSync(new URL(`./fixtures/recognise/${name}.json`, import.meta.url), 'utf8'));
const paragraphs = (name: string) => textOfPage(photo(name)).split('\n');

const russian = { code: 'ru', name: 'Russian' };

describe('textOfPage', () => {
	it('leaves out the page number, and starts a paragraph after a gap or on an indented line', () => {
		expect(paragraphs('epigraph-and-page-number')).toEqual([
			'Ты должен сделать добро из зла, потому что его больше не из чего сделать.',
			'Р. ПІ. Уоррен',
			'Из интервью, которое специальный корреспондент Хармонтского радио взял у доктора Валентина Пильмана по случаю присуждения последнему Нобелевской премии по физике за 19.. год',
			'— ...Вероятно, вашим первым серьезным открытием, доктор Пильман, следует считать так называемый радиант Пильмана?',
			'— Полагаю, что нет. Радиант Пильмана — это не первое, не серьезное и, собственно, не открытие. И не совсем мое.',
			'— Вы, вероятно, шутите, доктор. Радиант Пильмана — понятие, известное всякому школьнику.',
			'— Это меня не удивляет. Радиант Пильмана и был открыт впервые именно школьником. К сожалению, я не помню, как его звали. Посмотрите у Стетсона в его «Истории Посещения» — там все это подробно рассказано. Открыл радиант впервые школьник, опубликовал координаты впервые студент, а назвали радиант почему-то моим именем.',
			'— Да, с открытиями происходят иногда удивительные вещи. Не могли бы вы объяснить нашим слушателям, доктор Пильман...'
		]);
	});

	it('reads a tilted photo’s lines in order, by where each starts', () => {
		// Vision gave the last line before the one above it.
		expect(paragraphs('tilted-lines-out-of-order').at(-1)).toMatch(/очень гладкую кривую\. Я сосчитал координаты радианта и послал их в «Нэйчур»\.$/);
		expect(paragraphs('facing-page-at-the-edge').at(-1)).toBe(
			'— Давайте лучше поговорим об искусстве. Неужели слушателей не интересует мое мнение о несравненной Гвади Мюллер?'
		);
	});

	it('leaves out the facing page and a bookmark at the sides, but keeps a paragraph’s short last line', () => {
		const text = textOfPage(photo('facing-page-at-the-edge'));
		for (const edge of ['наук', 'НЕТНІ', 'крас', 'цах', '8']) expect(text.split(/\s+/)).not.toContain(edge);
		expect(text).toContain('Это настоящая новая профессия.\n— Понимаю.');

		const short = paragraphs('short-page');
		expect(short).toEqual([
			'— О, разумеется! Но я хотел бы сначала покончить с наукой. Вас как ученого не тянет самому заняться инопланетными чудесами?',
			'— Как вам сказать... Пожалуй.',
			'— Значит, можно надеяться, что хармонтцы в один прекрасный день увидят своего знаменитого земляка на улинах родного города?',
			'— Не исключено.'
		]);
	});

	it('joins a line Vision read in two pieces', () => {
		expect(paragraphs('line-read-in-two-pieces')).toContain('— Здорово, — он мне говорит. — Тебя, — говорит, — Рыжий, по всему Институту ищут...');
	});

	it('keeps a chapter’s heading apart from its text', () => {
		const [heading, first] = paragraphs('chapter-start');
		expect(heading).toBe('1. Рэдрик Шухарт, 23 года, холост, лаборант Хармонтского филиала Международного Института Внеземных Культур');
		expect(first).toMatch(/^Накануне стоим это мы с ним в хранилище — уже вечером,/);
	});
});

describe('appendRecognised', () => {
	it('mends a Word hyphenated across two photos', () => {
		const text = appendRecognised(textOfPage(photo('chapter-start')), textOfPage(photo('chapter-continued')));
		expect(text).toContain('То есть совсем ничего, пусто. Можно туда просунуть руку');
	});

	it('runs a Sentence on, and starts a new paragraph after one that ended', () => {
		expect(appendRecognised('а сам примостился', 'рядом на подоконнике.')).toBe('а сам примостился рядом на подоконнике.');
		expect(appendRecognised('Тут я даже закряхтел.', '— Нельзя мне.')).toBe('Тут я даже закряхтел.\n— Нельзя мне.');
		expect(appendRecognised('', 'Первая.')).toBe('Первая.');
	});
});

describe('the clean-up rules', () => {
	it('joins a Word hyphenated at a line’s end, but not before a capital', () => {
		expect(joinLines('я не по-', 'мню')).toBe('я не помню');
		expect(joinLines('Земля -', 'Денеб')).toBe('Земля - Денеб');
		expect(joinLines('вдоба-', 'BOK')).toBe('вдоба- BOK');
	});

	it('makes a dash of a hyphen that opens dialogue or stands apart, not one inside a Word', () => {
		expect(typesetDashes('- Слушай,- говорю, - Кирилл!')).toBe('— Слушай, — говорю, — Кирилл!');
		expect(typesetDashes('— Ну да, — говорю.— Эта')).toBe('— Ну да, — говорю. — Эта');
		expect(typesetDashes('-- Здорово')).toBe('— Здорово');
		expect(typesetDashes('• Послушайте')).toBe('— Послушайте');
		expect(typesetDashes('почему-то по-тарабарски, Н-ну')).toBe('почему-то по-тарабарски, Н-ну');
	});
});

describe('recogniseFiles', () => {
	const pages: Record<string, RecognisedPage> = {
		'a.heic': { file: 'a.heic', lines: photo('chapter-start').lines },
		'b.pdf': { file: 'b.pdf', text: 'го, пусто.' }
	};
	const fake: ReadFiles = async (paths, language) => {
		expect(language.code).toBe('ru');
		return paths.map((p) => pages[p.split('/').at(-1)!]);
	};

	it('reads photos, PDFs and text files in order, as one text', async () => {
		const folder = await mkdtemp(join(tmpdir(), 'recognise-spec-'));
		try {
			await writeFile(join(folder, 'c.txt'), 'Конец.');
			const text = await recogniseFiles(fake, russian, [join(folder, 'a.heic'), join(folder, 'b.pdf'), join(folder, 'c.txt')]);
			expect(text).toMatch(/^1\. Рэдрик Шухарт/);
			expect(text).toMatch(/То есть совсем ничего, пусто\.\nКонец\.$/);
		} finally {
			await rm(folder, { recursive: true });
		}
	});

	it('refuses other files, no files, and files with no text', async () => {
		await expect(recogniseFiles(fake, russian, ['/x/book.epub'])).rejects.toThrow("book.epub isn't a photo, a PDF or a text file.");
		await expect(recogniseFiles(fake, russian, [])).rejects.toThrow(CannotRecognise);
		await expect(recogniseFiles(async () => [{ file: 'a.png', lines: [] }], russian, ['/x/a.png'])).rejects.toThrow('No text was found.');
	});

	it('keeps an upload only while it is read', async () => {
		let seen: string[] = [];
		const text = await recogniseUploads(
			async (paths) => {
				seen = paths;
				return [{ file: 'p.pdf', text: 'Текст.' }];
			},
			russian,
			[{ name: 'Photo.PDF', bytes: new Uint8Array([1]) }]
		);
		expect(text).toBe('Текст.');
		expect(seen[0]).toMatch(/\/Photo\.PDF$/);
		await expect(readFileSafe(seen[0])).resolves.toBeUndefined();
	});

	it('reads Indonesian with the English reader, which has all its letters; others in their own', async () => {
		expect(visionLanguage('id')).toBe('en-US');
		expect(visionLanguage('ru')).toBe('ru');
		// Bosnian's č ć š ž aren't in any reader Vision has, so it stays refused by the helper.
		expect(visionLanguage('bs')).toBe('bs');
	});

	it('says how to build the Mac helper when it is missing', async () => {
		await expect(visionReader('/nowhere/recognise')(['/x/a.png'], russian)).rejects.toThrow('run `pnpm build:native`');
	});
});

describe('photoPreview', () => {
	it.runIf(process.platform === 'darwin')("shows an iPhone's HEIC photo as a JPEG", async () => {
		const jpeg = await photoPreview({ name: 'IMG_0333.HEIC', bytes: await heicPhoto() }, 200);
		expect([...jpeg.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
	});

	it('refuses what is not a photo', async () => {
		await expect(photoPreview({ name: 'book.pdf', bytes: new Uint8Array([1]) })).rejects.toThrow("book.pdf isn't a photo.");
		await expect(photoPreview({ name: 'broken.heic', bytes: new Uint8Array([1]) })).rejects.toThrow("broken.heic can't be shown.");
	});
});

async function readFileSafe(path: string) {
	try {
		return readFileSync(path);
	} catch {
		return undefined;
	}
}

/** A small HEIC photo, as an iPhone takes them: a BMP drawn here, turned to HEIC by macOS's `sips`. */
async function heicPhoto(): Promise<Uint8Array> {
	const folder = await mkdtemp(join(tmpdir(), 'recognise-spec-'));
	try {
		const [w, h] = [8, 8];
		const bmp = Buffer.alloc(54 + w * h * 4);
		bmp.write('BM');
		bmp.writeUInt32LE(bmp.length, 2);
		bmp.writeUInt32LE(54, 10);
		bmp.writeUInt32LE(40, 14);
		bmp.writeInt32LE(w, 18);
		bmp.writeInt32LE(h, 22);
		bmp.writeUInt16LE(1, 26);
		bmp.writeUInt16LE(32, 28);
		bmp.fill(0x80, 54);
		await writeFile(join(folder, 'a.bmp'), bmp);
		execFileSync('sips', ['-s', 'format', 'heic', join(folder, 'a.bmp'), '--out', join(folder, 'a.heic')], { stdio: 'ignore' });
		return new Uint8Array(readFileSync(join(folder, 'a.heic')));
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}
