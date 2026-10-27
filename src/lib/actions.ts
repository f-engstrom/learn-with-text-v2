/**
 * The address of a form action on the current page that keeps its query string (e.g. the Term
 * list's filters). After an enhanced form succeeds the page's address becomes the action's, so a
 * bare `?/name` would drop them.
 */
export function actionUrl(name: string, search: string): string {
	const query = search.replace(/^\?/, '');
	return `?${query ? `${query}&` : ''}/${name}`;
}
