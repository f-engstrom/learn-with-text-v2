import { defineMain } from '@storybook/sveltekit/node';
import type { Plugin, PluginOption } from 'vite';

async function flatten(options: PluginOption[]): Promise<Plugin[]> {
	const plugins: Plugin[] = [];
	for (const option of options) {
		const resolved = await option;
		if (Array.isArray(resolved)) plugins.push(...(await flatten(resolved)));
		else if (resolved) plugins.push(resolved as Plugin);
	}
	return plugins;
}

export default defineMain({
	framework: '@storybook/sveltekit',
	// Nothing about this project is reported to Storybook.
	core: { disableTelemetry: true },
	stories: ['../src/**/*.stories.svelte'],
	addons: ['@storybook/addon-themes', '@storybook/addon-a11y', '@storybook/addon-vitest'],
	async viteFinal(config) {
		// SvelteKit's plugin mounts the app's own server in Vite's dev server. Left in, a request
		// Storybook doesn't answer would run the app's hooks, which open the Reader's database.
		// Stories never reach the app's server (ADR 0007), so its middleware comes out.
		const plugins = (await flatten(config.plugins ?? [])).map((plugin) =>
			plugin.name === 'vite-plugin-sveltekit-setup'
				? { ...plugin, configureServer: undefined, configurePreviewServer: undefined }
				: plugin
		);
		return { ...config, plugins };
	}
});
