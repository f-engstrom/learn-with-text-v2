# Directions to explore

Ideas that aren't planned yet, kept so they aren't forgotten. Nothing here is decided. A direction becomes slices, with an ADR where it changes a decision, once we choose to build it.

## Reading and tutoring from a phone

Today the Tutor reaches the Reader only through the stdio MCP server that Claude Code starts on this computer ([ADR 0003](adr/0003-reader-owns-progress-tutor-via-stdio-mcp.md)). From a phone, that means driving a Claude Code session on this computer with Remote Control and opening the reading screen over the local network (`pnpm start --host`). That works without new code, but it needs a session open here.

### An HTTP `/mcp` endpoint in the app

The Reader could also serve its MCP tools over HTTP at `/mcp`, from inside the SvelteKit app, using the SDK's Streamable HTTP transport with the same `createReaderServer` that [main.ts](../src/lib/server/mcp/main.ts) uses. Added in claude.ai as a custom connector, the Tutor would then be available in the Claude phone app, in cloud sessions and in scheduled routines, with no Claude Code session needed here. The stdio server would stay, so tutoring in Claude Code keeps working when the app isn't running.

- **It revisits ADR 0003**, which rejected an in-app `/mcp` because tutoring would need the app running. For a phone the app has to run anyway, and one process writing the database would let the reading screen update live. Adding it would need an ADR that keeps stdio alongside HTTP.
- **It needs auth before it's reachable from outside.** The connector calls in from Anthropic's servers, so the endpoint must be public. That rules out putting Cloudflare Access in front of it. The simplest option is a long secret in the path (`/mcp/<secret>`). OAuth, which connectors support, is the proper one. Only `/mcp` should be exposed, never the reading screen.
- **It needs a stable address.** A Cloudflare quick tunnel (`cloudflared tunnel --url`) gets a new random address on each start, so the connector would need re-adding every time. A stable address takes either a named tunnel, which needs a domain on Cloudflare, or Tailscale Funnel. Tailscale would also let the phone reach the reading screen privately, with only `/mcp` exposed through Funnel.
- **Long waits.** `ask_learner` and `wait_for_answer` wait up to 120 s ([ADR 0006](adr/0006-tutor-waits-for-answers-in-a-blocking-tool-call.md)). Cloudflare gives up on a response that hasn't started within about 100 s. Streaming responses should avoid this. Otherwise the default wait would have to drop below 90 s. Untested.
- **This computer must stay awake** while it serves the endpoint.

### Hosting the app on a free tier

Hosting the Reader somewhere that's always on would remove the tunnel and the need to keep this computer awake. The reading screen and `/mcp` would then be reachable from anywhere. The catch is the database: the Reader is one SQLite file opened with better-sqlite3, so a host needs a persistent disk, or the database has to move.

- **A small always-free VM** (e.g. Oracle Cloud's free tier) keeps the app as it is: Node, a disk, SQLite.
- **Platforms without a persistent disk on the free tier** (e.g. Render, whose free services also sleep) would lose the database on restart unless it moves to a hosted SQLite such as Turso (libSQL) or Cloudflare D1. Kysely has dialects for both, but better-sqlite3 is synchronous and the database code would need checking for that.
- **The whole app would need auth.** It has none, because today it's only reachable from this computer or the local network.
- **One database, not two.** With the Reader hosted, Claude Code on this computer should use the hosted `/mcp` rather than the stdio server against a local file, or progress splits in two. Moving the existing `data/reader.db` would be a one-off step.

Free tiers change often, so check what each one offers before choosing.

#### Cloudflare Workers + D1, or Deno Deploy

Little of the Reader is tied to Node. All database access goes through Kysely, which is async, so moving to another database means changing only [open.ts](../src/lib/server/db/open.ts), where better-sqlite3 (a native module neither platform runs) opens the file. The other Node-only piece is [frequency.ts](../src/lib/server/domain/frequency.ts), which reads the bundled frequency lists (about 800 KB) from `resources/` on disk. They could be bundled with the app or loaded at setup instead.

- **Cloudflare Workers + D1** fits best. D1 is SQLite, so the migrations and the triggers behind the Status history ([ADR 0005](adr/0005-status-history-recorded-by-the-database.md)) should mostly carry over. Kysely has a D1 dialect, and SvelteKit has an official Cloudflare adapter. A `*.workers.dev` address is stable and needs no tunnel. Cloudflare also supports remote MCP servers directly and has an OAuth library for them, which would answer the auth question properly. The risk is the free plan's limit of roughly 10 ms of CPU per request. Waiting costs no CPU, so `ask_learner` should be fine, but importing a Book (Readability, linkedom, splitting into Sentences, inserting rows) may go over it. That would mean splitting imports into steps or paying for the plan. Unmeasured: the first thing to check is how much CPU a typical import uses.
- **[celld](https://celld.dev/)**, from Deno Land, is a self-hosted runtime for the same Cloudflare APIs (Workers, Durable Objects, D1, KV, R2…). Each cell's SQLite database is replicated to a bucket you own. It isn't free hosting, because it needs a machine to run on. What it adds is a way out: a Reader built for Workers + D1 could start on Cloudflare's free plan and later move to celld on a VM, where the CPU limit doesn't apply. The bucket would also give off-machine backups of progress, which today exists only in `data/reader.db`.
- **Deno Deploy** runs SvelteKit too, but has no SQLite file to keep. The options are Deno KV, which isn't SQL and would mean rewriting the database code, or an outside database such as Turso or Postgres. That's more work than D1 for less in return.

#### Azure (a free account exists)

Unverified, from memory of Azure's offer: check the portal before relying on any of it. A free account gives credit for the first 30 days, some services free for 12 months, and a few that are always free.

**As the app is today**, the fit is the 12-month free Linux VM (B1s: 1 vCPU, 1 GB RAM, with a managed disk). Node, better-sqlite3 and the SQLite file run unchanged, Caddy in front gives HTTPS and a stable address, and the 12-month free Blob storage could hold backups of `reader.db`. 1 GB is tight for `vite build`, so build on this computer and copy `build/` over, or add swap. After 12 months it costs a few dollars a month. App Service and Container Apps keep files on Azure Files, where SQLite with WAL is unreliable, so they only fit if the database moves.

**Rebuilt for Azure's always-free services**, it could cost nothing beyond the first year, at the price of portability and the stdio server against a local file:

- **Hosting:** Static Web Apps (free) with managed Functions, which have a community SvelteKit adapter. Or Container Apps or Functions on their monthly free allowance, which scale to zero, so the first request after idling is slow.
- **Database:** the free Azure SQL Database offer, which is SQL Server, not SQLite. Kysely has a dialect for it, but the migrations, upserts and Status history triggers ([ADR 0005](adr/0005-status-history-recorded-by-the-database.md)) would need rewriting, and the tests run on in-memory SQLite. Cosmos DB's free tier isn't SQL, so it would mean rewriting the database code entirely.
- **The Tutor's waits:** `ask_learner` checks the database repeatedly while it waits. On a database billed by compute time, that keeps the database awake and uses up the free allowance. Request time limits (much shorter on Static Web Apps' managed Functions) may also mean a shorter default wait, which ADR 0006's `wait_for_answer` loop already allows. A push mechanism, such as Azure Web PubSub's free tier or SignalR, could replace the checking.

Either way, the app and `/mcp` need auth (Static Web Apps has built-in sign-in), and Claude Code on this computer should use the hosted `/mcp`.
