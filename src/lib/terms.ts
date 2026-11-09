// The Term vocabulary: Statuses and Sources, and how they read. Shared with the browser and the MCP server.
import type { Source, Status } from '#lib/server/domain/terms.ts';

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
