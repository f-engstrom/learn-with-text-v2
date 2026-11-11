# Reader

Use the words in [CONTEXT.md](CONTEXT.md) in code, comments and commits, and read the [ADRs](docs/adr) that touch an area before changing it.

## Where each concept lives

Domain rules sit in `src/lib/server/domain`, which the web app and the Tutor's MCP server (`src/lib/server/mcp/tools.ts`) both call; a rule enforced in a route or a tool only is a bug. Start with the file below; its spec beside it shows the interface in use.

| Concept | Start in |
|---|---|
| Language, splitting into Words and Sentences | `domain/languages.ts`, `domain/parsing.ts` |
| Normalised form, Character part | `lib/normalise.ts` (shared with the browser) |
| Book, Page, importing text or a file | `domain/books.ts` |
| Import from a web address (one address, one Book) | `domain/addresses.ts`, for the web page and the Tutor alike; readers in `domain/webpages.ts`, `suggestions.ts`, `classics.ts`, `feeds.ts` |
| Bookmark, Highlight, Read | `domain/reading.ts`; the Bookmark's Word in `lib/reading/bookmark.ts` |
| Selection (cursor, phrase, Character part), the Bookmark following it | `lib/reading/selection.svelte.ts` |
| Term, Translation, Source, Parent, Follows Parent, Status | `domain/terms.ts` (`saveTerm` does it all in one call); the Status and Source lists and labels in `lib/terms.ts` |
| Multi-word Term | `domain/multiword.ts` |
| Gloss, Tutor adjustment, Tutor's assessment, Transfer | `domain/tutoring.ts` |
| From the Tutor, Tutor's question | `domain/from-tutor.ts`; in the reading screen `lib/reading/from-tutor.svelte.ts` |
| Review, Due, Recall strength | `domain/practice.ts`; sent from the browser by `lib/reviews.ts` |
| Practice priority, practice wording | `lib/practice.ts` (shared with the browser and the MCP server) |
| Practice on the Page (subsets, the run, its keys) | `lib/reading/practice.svelte.ts` |
| Zen mode, Due marks | `lib/reading/zen.svelte.ts`, `lib/reading/persisted-flag.svelte.ts` |
| Which key goes where in the reading screen | `routeKey` in `lib/reading/keys.ts` |
| Frequency | `domain/frequency.ts` |
| Suggestion, Unknown share, Fit range, Topic | `domain/suggestions.ts`, `lib/suggestions.ts`, `domain/topics.ts` |
| Dictionary, Wiktionary panel, Azure panel | `lib/dictionaries.ts`, `domain/wiktionary.ts`, `domain/azure.ts` |
| Your languages | `domain/your-languages.ts` |
| Words read, Milestone, Status history, The day so far | `domain/progress.ts` |
| The design theme (colour, type, shape tokens; base controls; how a Status marks a Word) | `src/app.css`; shown in `src/stories/theme` |

The reading screen is `routes/books/[bookId]/pages/[position]/+page.svelte`, and its parts are components beside it: `PageText` and `Word` (the text), `TermPanel` (beside the text when something is selected), `Help` (the Keys and the legend), `PracticePanel`, `TutorTurn`. Its logic moves out into `lib/reading/` (keys and their routing, Selection, Practice, zen mode, Highlight on the Page, From the Tutor); the page is markup and wiring, and new logic goes into one of these modules, where its tests go. A module there is constructed during server-side rendering too, so it does nothing that reaches the server until its first `sync` or `start`, which the page calls in the browser.

## Conventions

- Domain functions take the database as their first argument and import nothing from SvelteKit, so the MCP server reuses them. Tests run them against `openDatabase(':memory:')` after `migrateToLatest`.
- `src/lib/*.ts` files are shared with the browser. They may import types from `lib/server`, never values.
- The Term form's field names and how they're read live in `lib/term-writes.ts` (`termFields`, `readTermForm`), with `sendStatus` for a Status on its own; `lib/server/term-actions.ts` is the form's actions.
- A Term column the learner and the Tutor see travels: migration, `db/schema.ts`, `domain/terms.ts` (`TermView`, `selectTerms`, `toViews`), `readTermForm` and `termFields` in `lib/term-writes.ts`, `TermForm.svelte`, the Term list, the reading screen's facts, and `termView` in `mcp/tools.ts`.
- A new migration is a file in `db/migrations` plus an entry in `db/migrate.ts`. Changing a CHECK constraint means rebuilding the table and re-creating its triggers (see `0021-azure-source.ts`).
- A broken rule is thrown as a subclass of `Refused` (`domain/refused.ts`), such as `InvalidTerm`; the MCP server's `guard` turns any of them into a message for the Tutor, so a new rule needs no wiring there.
- The browser reaches the server with plain JSON endpoints (`/books/[id]/tutor`, `/books/[id]/bookmark`, `/terms/[id]/reviews`, `/terms/status`, `/languages/[id]/fit-range`); form actions are for real `<form>`s with `use:enhance`.
- Status history and the Terms version are written by SQLite triggers (ADR 0005), not by domain code.
- The Tutor's assessment is stored as `term.tutor_level` and is `tutorAssessment` everywhere above the database.

## Checking how something looks

Storybook (`pnpm storybook`, port 6006) shows the theme, the components and every screen in each of their states, with no server and no database (ADR 0007). Check a design change there first, in both themes (the toolbar, or `&globals=theme:dark` on a story's address) and at the widths the styles break at (40rem and 60rem).

- A story sits beside what it shows: `Foo.stories.svelte` by `Foo.svelte`, `page.stories.svelte` by a route's `+page.svelte`. The theme's stories are in `src/stories/theme`, and read the tokens from `app.css`.
- A screen's story is the route's page inside the layout (`src/stories/Screen.svelte`), given the data its load would return. A new state of a screen gets a story.
- That data comes from `src/fixtures` (`#fixtures`): `world.ts` builds it with the domain, `pnpm fixtures` writes `fixtures.json`. After changing what a load returns, or a rule the fixtures pass through, run it and commit the result.
- `pnpm test:stories` renders every story in Chromium and runs its `play` function. `pnpm test:visual` also compares each with its snapshot in `src/stories/snapshots` (about three minutes). After a design change, run it, look at the differences it reports (the actual and diff images are in `.vitest-attachments`), and when they are the change you meant, `pnpm test:visual:update` and commit the new baselines. Baselines are Chromium's on macOS; they are not comparable from another system.
- A story that changes by itself as time passes sets `parameters.snapshot` to `false`; one whose state arrives after its `play` function waits for it there.
- A `fetch` in a story is answered by `src/stories/server.ts`; a story sets its own answers in `parameters.server` (e.g. `{ 'GET /api/wiktionary': { status: 502 } }`). A new endpoint needs a default there.

## Checking behaviour in the browser

For what needs the server: saving, imports, the Tutor's tools.

`data/reader.db` holds real reading progress, and a Tutor session may be using it. Point the dev server's `DATABASE_PATH` at a copy (`sqlite3 data/reader.db ".backup <copy>"`). `pnpm check` and `pnpm test` (and `vitest`) regenerate SvelteKit's env config, which switches a running dev server back to `.env`'s database. Run neither while it is up, and before anything that writes, confirm it is on the copy: give the copy a marker (e.g. rename a Book) and look for it.
