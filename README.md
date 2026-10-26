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

## Layout

- `src/lib/server/db`: connection, schema types and migrations.
- `src/lib/server/domain`: domain code. It takes a database connection as a parameter and doesn't import SvelteKit, so the MCP server can reuse it.
- `src/routes`: the web app.
