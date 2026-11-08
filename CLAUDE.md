# Reader

Use the words in [CONTEXT.md](CONTEXT.md) in code, comments and commits, and read the [ADRs](docs/adr) that touch an area before changing it.

## Where each concept lives

Domain rules sit in `src/lib/server/domain`, which the web app and the Tutor's MCP server (`src/lib/server/mcp/tools.ts`) both call; a rule enforced in a route or a tool only is a bug. Start with the file below; its spec beside it shows the interface in use.

| Concept | Start in |
|---|---|
| Language, splitting into Words and Sentences | `domain/languages.ts`, `domain/parsing.ts` |
| Normalised form, Character part | `lib/normalise.ts` (shared with the browser) |
| Book, Page, importing text or a file | `domain/books.ts` |
| Import from a web address | `domain/webpages.ts`; Wikipedia, Feeds and Classics in `domain/suggestions.ts`, `feeds.ts`, `classics.ts` |
| Bookmark, Highlight, Read | `domain/reading.ts`; the Bookmark's Word in `lib/reading/bookmark.ts` |
| Selection (cursor, phrase, Character part), the Bookmark following it | `lib/reading/selection.svelte.ts` |
| Term, Translation, Source, Parent, Follows Parent, Status | `domain/terms.ts` (`saveTerm` does it all in one call) |
| Multi-word Term | `domain/multiword.ts` |
| Gloss, Tutor adjustment, Tutor's assessment, Transfer | `domain/tutoring.ts` |
| From the Tutor, Tutor's question | `domain/from-tutor.ts`; in the reading screen `lib/reading/from-tutor.svelte.ts` |
| Review, Due, Recall strength | `domain/practice.ts`; sent from the browser by `lib/reviews.ts` |
| Practice priority, Status labels, practice wording | `lib/practice.ts` (shared with the browser and the MCP server) |
| Practice on the Page (subsets, the run, its keys) | `lib/reading/practice.svelte.ts` |
| Frequency | `domain/frequency.ts` |
| Suggestion, Unknown share, Fit range, Topic | `domain/suggestions.ts`, `lib/suggestions.ts`, `domain/topics.ts` |
| Dictionary, Wiktionary panel, Azure panel | `lib/dictionaries.ts`, `domain/wiktionary.ts`, `domain/azure.ts` |
| Your languages | `domain/your-languages.ts` |
| Words read, Milestone, Status history, The day so far | `domain/progress.ts` |

The reading screen is `routes/books/[bookId]/pages/[position]/+page.svelte`. Its logic moves out into `lib/reading/` (keys, Selection, Practice, Highlight on the Page, From the Tutor) as it is touched; that is where its tests go. A module there is constructed during server-side rendering too, so it does nothing that reaches the server until its first `sync` or `start`, which the page calls in the browser.

## Conventions

- Domain functions take the database as their first argument and import nothing from SvelteKit, so the MCP server reuses them. Tests run them against `openDatabase(':memory:')` after `migrateToLatest`.
- `src/lib/*.ts` files are shared with the browser. They may import types from `lib/server`, never values.
- The Term form's fields are parsed in `lib/server/term-actions.ts`, shared by the reading screen and the Term list.
- A Term column the learner and the Tutor see travels: migration, `db/schema.ts`, `domain/terms.ts` (`TermView`, `selectTerms`, `toViews`), `term-actions.ts`, `TermForm.svelte`, the Term list, the reading screen's facts, and `termView` in `mcp/tools.ts`.
- A new migration is a file in `db/migrations` plus an entry in `db/migrate.ts`. Changing a CHECK constraint means rebuilding the table and re-creating its triggers (see `0021-azure-source.ts`).
- Status history and the Terms version are written by SQLite triggers (ADR 0005), not by domain code.
- The Tutor's assessment is stored as `term.tutor_level` and is `tutorAssessment` everywhere above the database.

## Checking a change in the browser

`data/reader.db` holds real reading progress, and a Tutor session may be using it. Point the dev server's `DATABASE_PATH` at a copy (`sqlite3 data/reader.db ".backup <copy>"`). `pnpm check` and `pnpm test` (and `vitest`) regenerate SvelteKit's env config, which switches a running dev server back to `.env`'s database. Run neither while it is up, and before anything that writes, confirm it is on the copy: give the copy a marker (e.g. rename a Book) and look for it.
