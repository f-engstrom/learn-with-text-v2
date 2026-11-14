// The Term vocabulary: Statuses and Sources, and how they read. Shared with the browser and the MCP server.
import type { OriginKind, OriginSource, Source, Status } from '#lib/server/domain/terms.ts';

export const STATUSES: readonly Status[] = ['learning1', 'learning2', 'learning3', 'learning4', 'known', 'ignored'];

/** Learning 1–4: the Statuses that are practised (ADR 0004). */
export const LEARNING: readonly Status[] = ['learning1', 'learning2', 'learning3', 'learning4'];

/** Learning 1–4 and Known: the levels the Tutor's assessment and Recall strength are read on. */
export const LEVELS: readonly Status[] = [...LEARNING, 'known'];

export const isStatus = (value: string): value is Status => (STATUSES as readonly string[]).includes(value);

export const isLearning = (status: Status): boolean => LEARNING.includes(status);

export const statusLabels: Record<Status, string> = {
	learning1: 'Learning 1',
	learning2: 'Learning 2',
	learning3: 'Learning 3',
	learning4: 'Learning 4',
	known: 'Known',
	ignored: 'Ignored'
};

export const SOURCES: readonly Source[] = ['you', 'wiktionary', 'tutor', 'azure'];

export const isSource = (value: string | undefined): value is Source => value !== undefined && (SOURCES as readonly string[]).includes(value);

export const sourceLabels: Record<Source, string> = { you: 'You', wiktionary: 'Wiktionary', tutor: 'Tutor', azure: 'Azure' };

/** The kinds of link in an Origin, in the order the Term form offers them. */
export const ORIGIN_KINDS: readonly OriginKind[] = ['loanword', 'inherited', 'derived', 'calque', 'cognate'];

export const isOriginKind = (value: string): value is OriginKind => (ORIGIN_KINDS as readonly string[]).includes(value);

export const isOriginSource = (value: string | undefined): value is OriginSource =>
	value === 'you' || value === 'wiktionary' || value === 'tutor';

export const originKindLabels: Record<OriginKind, string> = {
	loanword: 'Loanword',
	inherited: 'Inherited',
	derived: 'Derived',
	calque: 'Calque',
	cognate: 'Cognate'
};

/** The mark before a link: '←' along the chain the word came by, '~' for a cognate beside it. */
export const originArrow = (kind: OriginKind): string => (kind === 'cognate' ? '~' : '←');
