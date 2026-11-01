import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_PATH: {
		description: 'Path to the SQLite file.',
		schema: (value) => value || 'data/reader.db'
	},
	AZURE_TRANSLATOR_KEY: {
		description: "An Azure Translator resource's key, for the Azure panel; without one the panel says it isn't set up.",
		schema: (value) => value ?? ''
	},
	AZURE_TRANSLATOR_REGION: {
		description: "The Azure Translator resource's region, e.g. northeurope.",
		schema: (value) => value ?? ''
	}
});
