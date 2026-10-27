# Reader

A personal tool for learning languages by reading. Vocabulary is in [CONTEXT.md](CONTEXT.md), decisions in [docs/adr](docs/adr), and the build plan in [docs/v1-slices.md](docs/v1-slices.md).

## Developing

```sh
npm install
npm run dev
```

The database is a single SQLite file at `DATABASE_PATH` (default `data/reader.db`). Migrations run when the server starts.

```sh
npm test        # unit tests
npm run check   # type check
```

## The Tutor's MCP server

`npm run --silent mcp` starts the Reader's MCP server over stdio. It opens the same database (`DATABASE_PATH`, relative to this folder), so the web app needn't be running. Claude Code picks it up from [.mcp.json](.mcp.json) when started in this folder.

Its tools only read for now: `list_languages`, `list_books`, `get_bookmark`, `get_sentences` (from the Bookmark, with each Word's Status), `look_up_term` and `get_suggestions`.

## Layout

- `src/lib/server/db`: connection, schema types and migrations.
- `src/lib/server/domain`: domain code. It takes a database connection as a parameter and doesn't import SvelteKit, so the MCP server can reuse it.
- `src/lib/server/mcp`: the MCP server's tools and its stdio entry point.
- `src/routes`: the web app.
