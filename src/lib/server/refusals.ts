import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { Refused } from './domain/refused';

// A broken rule, from any domain function, as the web app answers it: the routes' counterpart of the
// MCP server's `guard`, so a new rule needs no wiring here either.

/** Runs `work` for a JSON endpoint; any broken rule answers 400 with its message. */
export async function refusedAsError<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (e) {
		if (e instanceof Refused) error(400, e.message);
		throw e;
	}
}

/**
 * Runs `work` for a form action; any broken rule returns a 400 failure with its message, and `extra`
 * (such as the submitted values, to fill the form again).
 */
export async function refusedAsFailure<T, E extends object = object>(
	work: () => Promise<T>,
	extra?: E
): Promise<T | ActionFailure<{ message: string } & E>> {
	try {
		return await work();
	} catch (e) {
		if (e instanceof Refused) return fail(400, { message: e.message, ...(extra as E) });
		throw e;
	}
}
