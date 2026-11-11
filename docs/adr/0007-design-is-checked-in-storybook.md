# Design is checked in Storybook, on fixtures the domain builds

Changing how the Reader looks meant running the app against a copy of the database and working it into the state you wanted to see: a Term that is Due, a Tutor's question waiting, a Page nobody has read. Most states took minutes to reach and some needed a Tutor session. So the theme, the components and every screen now have stories in Storybook, each showing one state, and a design change is checked there, by eye or by an agent in a browser, without the app's server or its database.

A story's data is not written by hand. `pnpm fixtures` fills a database in memory through the domain's own functions, under a set clock, and writes what each route's load would return to `src/fixtures/fixtures.json`. A story therefore can't show a state the Reader can't reach, and a spec fails when the file is no longer what the domain builds. Small props for a single component may be written in its story.

Stories never reach the app's server. Each `fetch` a screen makes is answered from a table the story sets (`src/stories/server.ts`), form actions and navigation go to Storybook's SvelteKit mocks, and SvelteKit's own server is taken out of Storybook's Vite server so that no request there can run the app's hooks.

## Considered Options

- A `/design` route in the app: no new dependency, but it runs on the dev server and its database, and navigation, theming and mocking would have to be built. Rejected.
- Histoire: its Svelte plugin still targets Svelte 4. Rejected.
- Storybook 10, the stable release: it has no support for SvelteKit 3. Storybook 11 does and was in beta when this was decided, so it is pinned to an exact version until 11 is stable.
- Hand-written fixtures: simpler, but they drift from what the domain produces, and splitting text into Words by hand is error-prone. Rejected for screens.
- An in-memory fake of the server, so that saving a Term in a story changes what it shows: a second implementation of the domain. Rejected; a story shows a state, and the domain's specs cover the flows.
- Snapshots on a CI runner or a hosted service: the Reader uses the system's fonts, so a Linux browser renders text the learner never sees. Snapshots are taken on the developer's Mac, in Chromium, and their baselines are committed.

## Consequences

- The colour tokens hold both schemes (`light-dark()`), and `data-theme` on the root element forces one, so a story can be seen in either. The app itself still follows the system.
- A screen's story renders the route's real `+page.svelte` inside the layout. What can't be reached by data alone (a Selection, a Practice run, zen mode) is reached by the story's `play` function pressing the keys a learner would.
- The stories' clock starts at the moment the fixtures were read at, so what is Due stays Due.
- A change to what a load returns, or to a domain rule the fixtures pass through, means running `pnpm fixtures` and committing the result.
- Checking behaviour that needs the server (saving, the Tutor's tools, imports) still means running the app on a copy of the database.
