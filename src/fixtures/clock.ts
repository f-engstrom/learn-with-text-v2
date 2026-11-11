/** A clock the fixture generator sets, so every date the domain stamps is the same on each run. */
const RealDate = Date;
let current = RealDate.now();

class FixedDate extends RealDate {
	constructor(...args: unknown[]) {
		// @ts-expect-error Date's overloads don't take a spread.
		super(...(args.length ? args : [current]));
	}
	static now() {
		return current;
	}
}

/** Makes `new Date()` and `Date.now()` answer `iso` until it is set again or released. */
export function setClock(iso: string) {
	// Days are local days in the domain; the fixtures' are UTC's, wherever they are built.
	process.env.TZ = 'UTC';
	current = RealDate.parse(iso);
	globalThis.Date = FixedDate as DateConstructor;
}

export function releaseClock() {
	globalThis.Date = RealDate;
}
