import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Served by serve.js, which tells the adapter requests are plain http (see there).
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		// The stories' browser run leaves Vite's file watchers open; don't wait ten seconds for them.
		teardownTimeout: 1500,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}']
				}
			},
			{
				// Every story as a test, in Chromium: it renders and its play function runs (ADR 0007).
				// `pnpm test:stories`; with VITE_VISUAL set (`pnpm test:visual`) each is also compared with its snapshot.
				extends: './vite.config.ts',
				plugins: [storybookTest({ configDir: '.storybook' })],
				test: {
					name: 'stories',
					expect: { requireAssertions: false },
					// One story at a time: they share the browser window, whose size a snapshot sets.
					fileParallelism: false,
					testTimeout: 60_000,
					browser: {
						enabled: true,
						headless: true,
						// Storybook's plugin turns file writes off unless asked; snapshots need them. Only this machine reaches the test server.
						api: { host: '127.0.0.1', allowWrite: true },
						// Vitest shrinks a story's frame to fit the browser window, so the window is larger than any story:
						// a snapshot is then the story at its real size, however long the screen.
						provider: playwright({ contextOptions: { viewport: { width: 1400, height: 10000 } } }),
						instances: [{ browser: 'chromium' }],
						viewport: { width: 1280, height: 900 },
						expect: {
							toMatchScreenshot: {
								comparatorName: 'pixelmatch',
								comparatorOptions: { threshold: 0.1, allowedMismatchedPixelRatio: 0 },
								resolveScreenshotPath: ({ root, arg, ext }) => `${root}/src/stories/snapshots/${arg}${ext}`
							}
						}
					}
				}
			}
		]
	}
});
