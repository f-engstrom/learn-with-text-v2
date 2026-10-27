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

The build bakes in that address (SvelteKit checks it before accepting any form). For another one, set it at build time and start to match, e.g. `ORIGIN=http://localhost:4000 npm run build` then `PORT=4000 npm start`.

```sh
npm test        # unit tests
npm run check   # type check
```

## The Tutor's MCP server

`npm run --silent mcp` starts the Reader's MCP server over stdio. It opens the same database (`DATABASE_PATH`, relative to this folder), so the web app needn't be running. Claude Code picks it up from [.mcp.json](.mcp.json) when started in this folder.

Tools that read: `list_languages`, `list_books`, `where_am_i` (the most recently moved Bookmark, with the Word you last selected in the reading screen), `get_bookmark`, `get_sentences` (from the Bookmark, with each Word's Status), `look_up_term` and `get_suggestions`.

Tools that write: `save_gloss` (a Translation with Source Tutor, only for Unknown Words and Learning 1–2 Terms), `adjust_learning` (one step within Learning 1–4), `set_parent` (links a form to its dictionary form), `set_bookmark`, `mark_page_read` and `import_book` (from text or a web address). Their rules live in the domain code, so the web app and the Tutor can't disagree.

The Tutor itself is the [`reader-tutor`](.claude/skills/reader-tutor/SKILL.md) skill: the reading-tutor skill reworked to read from the Bookmark, Gloss by Status, make Tutor adjustments and find new Books through these tools, keeping only teaching notes in memory.

## Layout

- `src/lib/server/db`: connection, schema types and migrations.
- `src/lib/server/domain`: domain code. It takes a database connection as a parameter and doesn't import SvelteKit, so the MCP server can reuse it.
- `src/lib/server/mcp`: the MCP server's tools and its stdio entry point.
- `src/routes`: the web app.
