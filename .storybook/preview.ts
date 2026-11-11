import { definePreview } from '@storybook/sveltekit';
import addonA11y from '@storybook/addon-a11y';
import addonThemes, { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../src/app.css';

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
	parameters: {
		layout: 'padded',
		// The accessibility panel informs; it does not fail a story's test.
		a11y: { test: 'todo' },
		viewport: {
			options: {
				phone: { name: 'Phone (under 40rem)', styles: { width: '390px', height: '844px' } },
				tablet: { name: 'Tablet (under 60rem)', styles: { width: '820px', height: '1180px' } },
				desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' } }
			}
		}
	}
});
