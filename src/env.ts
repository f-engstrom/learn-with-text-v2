import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_PATH: {
		description: 'Path to the SQLite file.',
		schema: (value) => value || 'data/reader.db'
	},
	AZURE_TRANSLATOR_KEY: {
		description: "An Azure Translator resource's key, for the Azure Dictionary; without one its tab says how to set it up.",
		schema: (value) => value ?? ''
	},
	AZURE_TRANSLATOR_REGION: {
		description: "The Azure Translator resource's region, e.g. northeurope.",
		schema: (value) => value ?? ''
	}
});
