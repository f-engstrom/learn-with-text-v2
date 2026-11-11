/**
 * The stories' server: every `fetch` the screens make is answered here, from a table a story can
 * set in `parameters.server`. Nothing reaches the Reader's own server (ADR 0007). Each call shows
 * in Storybook's Actions panel.
 */
import { action } from 'storybook/actions';
import type { AzureResult } from '#lib/server/domain/azure.ts';
import type { WiktionaryResult } from '#lib/server/domain/wiktionary.ts';

export interface Call {
	method: string;
	url: URL;
	/** The JSON body, if it had one. */
	body: unknown;
}

export interface Reply {
	/** 200 with a body, 204 without, unless given. */
	status?: number;
	body?: unknown;
	/** Milliseconds before it answers; 'never' leaves the screen waiting. */
	delay?: number | 'never';
}

/** By `METHOD /path`, where `*` in the path stands for one segment. The first match answers. */
export type Server = Record<string, Reply | ((call: Call) => Reply)>;

export const wiktionary: WiktionaryResult = {
	title: 'привыкший',
	entries: [
		{ partOfSpeech: 'Participle', definitions: ['past active perfective participle of привыкнуть', 'accustomed, used to'] },
		{ partOfSpeech: 'Adjective', definitions: ['habitual'] }
	]
};

export const azure: AzureResult = {
	kind: 'dictionary',
	entries: [
		{ partOfSpeech: 'Adjective', translations: ['accustomed', 'used'] },
		{ partOfSpeech: 'Verb', translations: ['got used'] }
	]
};

/** What the Reader's endpoints answer when all goes well. */
export const defaults: Server = {
	// The entry is always the same; its title is the Word that was looked up.
	'GET /api/wiktionary': ({ url }) => ({ body: { ...wiktionary, title: url.searchParams.get('text') ?? wiktionary.title } }),
	'GET /api/azure': { body: azure },
	// The Tutor has nothing new: the screen keeps what its load gave it.
	'GET /books/*/tutor': { status: 404 },
	'POST /books/*/tutor': {},
	'DELETE /books/*/tutor': {},
	'PUT /books/*/bookmark': {},
	'POST /terms/*/reviews': {},
	'PUT /terms/status': {},
	'PUT /languages/*/fit-range': {}
};

const matches = (pattern: string, call: Call) => {
	const [method, path] = pattern.split(' ');
	const segments = path.split('/');
	const actual = call.url.pathname.split('/');
	return method === call.method && segments.length === actual.length && segments.every((s, i) => s === '*' || s === actual[i]);
};

const log = action('server');

/** Replaces `fetch` for same-origin addresses until the returned function is called. */
export function installServer(table: Server = {}): () => void {
	const real = globalThis.fetch;
	const routes = Object.entries({ ...table, ...Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in table))) });
	globalThis.fetch = async (input, init) => {
		const request = new Request(input, init);
		const url = new URL(request.url, location.href);
		// Storybook's own requests (its modules, hot reload) go through.
		if (url.origin !== location.origin || /^\/(@|node_modules|src|\.storybook|sb-|index\.json|iframe)/.test(url.pathname)) {
			return real(input, init);
		}
		const body = await request
			.clone()
			.json()
			.catch(() => undefined);
		const call: Call = { method: request.method, url, body };
		log(`${call.method} ${url.pathname}${url.search}`, body);
		const found = routes.find(([pattern]) => matches(pattern, call))?.[1];
		const reply: Reply = typeof found === 'function' ? found(call) : (found ?? { status: 404, body: { message: 'No such endpoint in this story.' } });
		if (reply.delay === 'never') {
			return new Promise<Response>((_, reject) => {
				request.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
			});
		}
		if (reply.delay) await new Promise((resolve) => setTimeout(resolve, reply.delay as number));
		const status = reply.status ?? (reply.body === undefined ? 204 : 200);
		return status === 204 ? new Response(null, { status }) : Response.json(reply.body ?? null, { status });
	};
	return () => {
		globalThis.fetch = real;
	};
}
