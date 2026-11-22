import { lady } from '../fixtures/texts.ts';
import texts from './photos/texts.json';
import type { Server } from './server.ts';

/** A stand-in for a phone's photo of a printed page, for the stories that read photos (Recognise). */
export async function photoOfText(name = 'page.png'): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = 480;
	canvas.height = 640;
	const g = canvas.getContext('2d')!;
	g.fillStyle = '#f4efe4';
	g.fillRect(0, 0, 480, 640);
	g.fillStyle = '#222';
	g.font = '22px Georgia, serif';
	['Старый мост через реку', 'снова открыт. Его ремонти-', 'ровали почти два года.'].forEach((line, i) => g.fillText(line, 32, 80 + i * 40));
	const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
	return new File([blob], name, { type: 'image/png' });
}


const pages = import.meta.glob<string>('./photos/*.jpg', { eager: true, import: 'default' });

/**
 * Real phone photos of three printed Russian pages in a row (5–7 of a novel), tilted, with the
 * facing page's edge and a bookmark showing: for the stories that check the text against the
 * photos it came from. Their text, as the server reads it, is in `photos/texts.json`.
 */
export async function photosOfPages(): Promise<File[]> {
	return Promise.all(
		Object.keys(texts).map(async (name) => {
			const blob = await (await fetch(pages[`./photos/${name}`])).blob();
			return new File([blob], name, { type: 'image/jpeg' });
		})
	);
}

/** The stories' server reading each of `photosOfPages` as macOS 15's Vision and `domain/recognise.ts` did. */
export const readsPages: { server: Server } = {
	server: {
		'POST /languages/*/recognise': ({ body }) => {
			const file = body instanceof FormData ? body.get('files') : null;
			const text = file instanceof File ? texts[file.name as keyof typeof texts] : undefined;
			return text === undefined ? { status: 400, body: { message: 'Not one of the stories’ photos.' } } : { body: { text }, delay: 300 };
		}
	}
};

/**
 * What the text box holds before the photos are added: two Pages pasted earlier, and a `---` line
 * typed after them so the photos' text starts a new Page.
 */
export const pagesSoFar = `${lady.split('\n---\n').slice(0, 2).join('\n---\n')}\n---\n`;
