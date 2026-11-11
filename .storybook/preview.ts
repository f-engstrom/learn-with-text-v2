import { definePreview } from '@storybook/sveltekit';
import addonA11y from '@storybook/addon-a11y';
import addonThemes, { withThemeByDataAttribute } from '@storybook/addon-themes';
import { action } from 'storybook/actions';
import { fixtures } from '../src/fixtures';
import { startClock } from '../src/stories/clock';
import { installServer, type Server } from '../src/stories/server';
import '../src/app.css';

const followed = action('link');

export default definePreview({
	addons: [addonThemes(), addonA11y()],
	decorators: [
		// app.css follows the system unless the root element's data-theme forces a scheme.
		withThemeByDataAttribute({
			themes: { light: 'light', dark: 'dark' },
			defaultTheme: 'light',
			attributeName: 'data-theme'
		})
	],
	/** Before each story: its server, the fixtures' clock, and nothing remembered from the last story. */
	beforeEach({ parameters }) {
		localStorage.clear();
		const stopServer = installServer(parameters.server as Server | undefined);
		const stopClock = startClock(fixtures.now);
		return () => {
			stopServer();
			stopClock();
			delete document.documentElement.dataset.zen;
		};
	},
	/** After each story, when run by `pnpm test:visual`: it is compared with its snapshots. */
	async afterEach({ id, title, parameters }) {
		// A story that changes by itself as time passes sets `parameters.snapshot` to false.
		if (!import.meta.env.VITE_VISUAL || parameters.snapshot === false) return;
		const { snapshot } = await import('../src/stories/snapshot');
		await snapshot({ id, title });
	},
	parameters: {
		layout: 'padded',
		// The accessibility panel informs; it does not fail a story's test.
		a11y: { test: 'todo' },
		sveltekit_experimental: {
			// A link to another screen goes nowhere in a story; the Actions panel says where it led.
			hrefs: { '.*': { callback: (to: string) => followed(to), asRegex: true } }
		},
		viewport: {
			options: {
				phone: { name: 'Phone (under 40rem)', styles: { width: '390px', height: '844px' } },
				tablet: { name: 'Tablet (under 60rem)', styles: { width: '820px', height: '1180px' } },
				desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' } }
			}
		}
	}
});
