/** The stories' clock: it starts at the moment the fixtures were read at, so "Due 3 days ago" stays so. */
const RealDate = Date;

/** Makes `new Date()` and `Date.now()` start from `iso` (and run on from there) until the returned function is called. */
export function startClock(iso: string): () => void {
	const offset = RealDate.parse(iso) - RealDate.now();
	class StoryDate extends RealDate {
		constructor(...args: unknown[]) {
			// @ts-expect-error Date's overloads don't take a spread.
			super(...(args.length ? args : [RealDate.now() + offset]));
		}
		static now() {
			return RealDate.now() + offset;
		}
	}
	globalThis.Date = StoryDate as DateConstructor;
	return () => {
		globalThis.Date = RealDate;
	};
}
