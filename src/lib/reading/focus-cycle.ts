/**
 * Keeps Tab inside a panel: a guard at each end of it, which Tab reaches on its way out, sends focus
 * around to the panel's other end. A guard also catches Tab coming in from outside, and sends it to
 * the end it came in at. Guards rather than catching Tab's key press, so Tab out of a dictionary's
 * page (an iframe, whose keys the screen never sees) comes back around too.
 */

/** Which guard: before the panel's first stop or after its last. */
export type Guard = 'start' | 'end';

/**
 * Where a guard sends focus: around to the other end when it came from inside the panel (or from an
 * iframe in it, which leaves no trace), to the near end when it came from outside.
 */
export function guardSends(guard: Guard, from: 'inside' | 'outside'): 'first' | 'last' {
	if (from === 'outside') return guard === 'start' ? 'first' : 'last';
	return guard === 'start' ? 'last' : 'first';
}

const stops = 'a[href], button, input, select, textarea, iframe, summary, [tabindex]';

/** The elements in `panel` Tab stops at, in order, but for its guards. */
export function tabStops(panel: HTMLElement): HTMLElement[] {
	return [...panel.querySelectorAll<HTMLElement>(stops)].filter(
		(el) =>
			el.tabIndex >= 0 &&
			!('guard' in el.dataset) &&
			!(el as HTMLButtonElement).disabled &&
			// A radio button but the checked one in its group is passed over.
			!(el instanceof HTMLInputElement && el.type === 'radio' && !el.checked && radioChecked(el)) &&
			el.getClientRects().length > 0
	);
}

function radioChecked(radio: HTMLInputElement) {
	return radio.form?.querySelector(`input[type=radio][name="${CSS.escape(radio.name)}"]:checked`) != null;
}

/** For a guard's `onfocus`: moves focus to the end of `panel` that `guardSends` names. */
export function guard(panel: HTMLElement | undefined, which: Guard, e: FocusEvent) {
	if (!panel) return;
	const came = e.relatedTarget;
	const from = came instanceof Node && !panel.contains(came) ? 'outside' : 'inside';
	const all = tabStops(panel);
	(guardSends(which, from) === 'first' ? all[0] : all.at(-1))?.focus();
}
