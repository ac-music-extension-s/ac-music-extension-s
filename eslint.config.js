import js from '@eslint/js';

export default [
	{
		ignores: ['scripts/options/zepto.min.js', 'offscreen.bundle.js'],
	},
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'module',
			globals: {
				// Basic browser globals
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
				setTimeout: 'readonly',
				setInterval: 'readonly',
				clearTimeout: 'readonly',
				clearInterval: 'readonly',
				addEventListener: 'readonly',

				// ES6+ globals
				Atomics: 'readonly',
				SharedArrayBuffer: 'readonly',

				// Web APIs
				navigator: 'readonly',
				fetch: 'readonly',
				URL: 'readonly',
				XMLHttpRequest: 'readonly',

				// Audio/Media APIs
				AudioContext: 'readonly',
				MediaMetadata: 'readonly',

				// Chrome Extension APIs
				chrome: 'readonly',

				// Extension-specific globals (defined across files)
				StateManager: 'readonly',
				AudioManager: 'readonly',
				NotificationManager: 'readonly',
				BadgeManager: 'readonly',
				MediaSessionManager: 'readonly',
				TabAudioHandler: 'readonly',
				TimeKeeper: 'readonly',
				TownTuneManager: 'readonly',
				WeatherManager: 'readonly',

				// Utility functions
				formatHour: 'readonly',
				printDebug: 'readonly',
				capitalize: 'readonly',
				getLocalUrl: 'readonly',
				checkMediaSessionSupport: 'readonly',
				createSampler: 'readonly',
				createTunePlayer: 'readonly',
				createBooper: 'readonly',
				updateContributors: 'readonly',
			},
		},
	},
];
