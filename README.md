# Reader

A personal tool for learning languages by reading. Vocabulary is in [CONTEXT.md](CONTEXT.md), decisions in [docs/adr](docs/adr), and the build plan in [docs/v1-slices.md](docs/v1-slices.md).

## Developing

```sh
npm install
npm run dev
```

The database is a single SQLite file at `DATABASE_PATH` (default `data/reader.db`). Migrations run when the server starts.

To run it day to day, build it once and start the built app at http://localhost:3000:

```sh
npm run build
npm start
```

Like `vite --host`, it serves this computer only unless you add `--host`, which also makes it reachable on your network and prints the addresses:

```sh
npm start -- --host
```

`PORT` and `HOST` override the port and the address it listens on. [serve.js](serve.js) marks every request as plain http, so forms work at any address you open it by (localhost, the network address, the computer's `.local` name). The Reader has no login: anyone on the network can read and change it.

```sh
npm test        # unit tests
npm run check   # type check
```

## Practice

Spaced repetition runs alongside reading ([ADR 0004](docs/adr/0004-three-views-of-knowing-a-word.md), [Practice slices](docs/practice-slices.md)). Learning 1–4 Terms get an FSRS schedule (ts-fsrs) from their Reviews. Due Words carry a dot in the reading screen (D hides the dots), R practises them on the Page, and Terms → Review Due Terms goes through them with an example Sentence from your Books. Frequency bands come from the lists in [resources/frequency](resources/frequency/README.md) (CC BY-SA 4.0), loaded into the database the first time a Language needs them; the app and the MCP server read them relative to this folder.

## The Tutor's MCP server

`npm run --silent mcp` starts the Reader's MCP server over stdio. It opens the same database (`DATABASE_PATH`, relative to this folder), so the web app needn't be running. Claude Code picks it up from [.mcp.json](.mcp.json) when started in this folder.

Tools that read: `list_languages`, `list_books`, `where_am_i` (the most recently moved Bookmark, with the Word you last selected in the reading screen), `get_bookmark`, `get_sentences` (from the Bookmark, with each Word's Status), `look_up_term`, `get_suggestions`, `get_due_terms` (Due Terms by Practice priority) and `list_your_languages`.

Tools that write: `save_gloss` (a Translation with Source Tutor, only for Unknown Words and Learning 1–2 Terms), `assess_term` (a Tutor adjustment of its own assessment from an answer, which also counts as a Review; it never changes your Status), `set_transfer`, `set_your_language` and `remove_your_language`, `set_parent` (links a form to its dictionary form), `set_bookmark`, `set_highlight` and `clear_highlight` (points the learner at Sentences; the open reading screen shows it within seconds), `mark_page_read` and `import_book` (from text or a web address). Their rules live in the domain code, so the web app and the Tutor can't disagree.

The Tutor itself is the [`reader-tutor`](.claude/skills/reader-tutor/SKILL.md) skill: the reading-tutor skill reworked to read from the Bookmark, Gloss by Status, make Tutor adjustments and find new Books through these tools, keeping only teaching notes in memory.

## Layout

- `src/lib/server/db`: connection, schema types and migrations.
- `src/lib/server/domain`: domain code. It takes a database connection as a parameter and doesn't import SvelteKit, so the MCP server can reuse it.
- `src/lib/server/mcp`: the MCP server's tools and its stdio entry point.
- `src/routes`: the web app.
