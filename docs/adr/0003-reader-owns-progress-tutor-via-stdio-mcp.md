# The Reader owns progress; the Tutor reaches it over a stdio MCP server

The reading-tutor skill originally kept the text position and vocabulary in its own memory file. We make the Reader the source of truth for Books, Bookmarks and Terms, and expose them to the Tutor through an MCP server. The Tutor keeps only teaching notes (level, chunk size, weak spots, patterns learned) in its memory. The MCP server is a separate stdio process that Claude launches. It opens the same SQLite file and reuses the Reader's domain code, so tutoring works even when the web app isn't running.

## Considered Options

- An HTTP `/mcp` endpoint inside the SvelteKit app: one process writes the database and the reading screen could update live, but tutoring would need the app running. Rejected.
- A read-only MCP server: simpler, but glosses and status changes would stay trapped in the Tutor's memory. Rejected.

## Consequences

- Two processes may write the database at once, so SQLite runs in WAL mode with a busy timeout, and every rule (e.g. Tutor adjustments stay within Learning 1–4) is enforced in shared domain code, not in either entry point.
- An open reading screen doesn't see Tutor changes until it reloads.
- This repo ships its own variant of the reading-tutor skill that uses the MCP tools.
