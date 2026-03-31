'use strict';

import { AudioManager } from './scripts/background/AudioManager.js';
import { printDebug } from './scripts/background/Utility.js';

// Storage helper functions for offscreen context

// Helper function to ensure service worker is ready
globalThis.ensureServiceWorkerReady = function () {
	return new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			reject(new Error('Service worker ping timeout'));
		}, 2000);

		chrome.runtime.sendMessage(
			{
				type: 'ping',
				target: 'service-worker',
			},
			() => {
				clearTimeout(timeoutId);
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
				} else {
					resolve();
				}
			}
		);
	});
};

globalThis.getStorage = function (storageType, keys, retryCount = 0) {
	return new Promise((resolve, reject) => {
		const maxRetries = 2;
		const timeoutMs = 3000;

		const performStorageRequest = async () => {
			try {
				// Ensure service worker is ready before making storage requests
				if (retryCount === 0) {
					await globalThis.ensureServiceWorkerReady();
					printDebug(
						`[offscreen.js] Service worker confirmed ready for getStorage`
					);
				}
			} catch (error) {
				printDebug(`[offscreen.js] Service worker not ready:`, error);
				if (retryCount < maxRetries) {
					setTimeout(
						() => {
							globalThis
								.getStorage(storageType, keys, retryCount + 1)
								.then(resolve)
								.catch(reject);
						},
						1000 * (retryCount + 1)
					);
					return;
				} else {
					reject(
						new Error(`Service worker not ready after ${maxRetries} attempts`)
					);
					return;
				}
			}

			// Add timeout to prevent hanging
			const timeoutId = setTimeout(() => {
				if (retryCount < maxRetries) {
					printDebug(
						`[offscreen.js] getStorage timeout, retrying... (${retryCount + 1}/${maxRetries})`
					);
					clearTimeout(timeoutId);
					// Retry with exponential backoff
					setTimeout(
						() => {
							globalThis
								.getStorage(storageType, keys, retryCount + 1)
								.then(resolve)
								.catch(reject);
						},
						500 * (retryCount + 1)
					);
				} else {
					reject(
						new Error(
							`Storage getStorage timeout after ${maxRetries} retries for ${storageType}`
						)
					);
				}
			}, timeoutMs);

			printDebug(
				`[offscreen.js] getStorage request:`,
				storageType,
				keys,
				`(attempt ${retryCount + 1})`
			);

			chrome.runtime.sendMessage(
				{
					type: 'getStorage',
					target: 'service-worker',
					data: { storageType, keys },
				},
				(result) => {
					clearTimeout(timeoutId);
					if (chrome.runtime.lastError) {
						printDebug(
							`[offscreen.js] getStorage chrome.runtime.lastError:`,
							chrome.runtime.lastError.message
						);
						if (retryCount < maxRetries) {
							printDebug(
								`[offscreen.js] getStorage retrying due to runtime error... (${retryCount + 1}/${maxRetries})`
							);
							setTimeout(
								() => {
									globalThis
										.getStorage(storageType, keys, retryCount + 1)
										.then(resolve)
										.catch(reject);
								},
								500 * (retryCount + 1)
							);
						} else {
							reject(new Error(chrome.runtime.lastError.message));
						}
					} else if (result && result.success) {
						printDebug(`[offscreen.js] getStorage success:`, result.data);
						resolve(result.data);
					} else {
						printDebug(
							`[offscreen.js] getStorage failed:`,
							result?.error || 'Unknown error'
						);
						if (retryCount < maxRetries) {
							printDebug(
								`[offscreen.js] getStorage retrying due to failed response... (${retryCount + 1}/${maxRetries})`
							);
							setTimeout(
								() => {
									globalThis
										.getStorage(storageType, keys, retryCount + 1)
										.then(resolve)
										.catch(reject);
								},
								500 * (retryCount + 1)
							);
						} else {
							reject(new Error(result?.error || 'Storage operation failed'));
						}
					}
				}
			);
		};

		performStorageRequest();
	});
};

// setStorage helper function
globalThis.setStorage = async function (items) {
	if (!items || typeof items !== 'object') {
		throw new Error('setStorage requires an object with key-value pairs');
	}

	// Ensure service worker is ready before attempting storage operation
	await globalThis.ensureServiceWorkerReady();

	const maxRetries = 3;
	const baseDelay = 100;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			printDebug(`[offscreen.js] setStorage attempt ${attempt}, items:`, items);

			const response = await chrome.runtime.sendMessage({
				target: 'service-worker',
				type: 'setStorage',
				items: items,
			});

			if (response && response.success) {
				printDebug('[offscreen.js] setStorage successful');
				return;
			} else {
				const error = `setStorage failed: ${response?.error || 'Unknown error'}`;
				if (attempt === maxRetries) {
					printDebug(`[offscreen.js] ${error} (final attempt)`);
					throw new Error(error);
				}
				printDebug(
					`[offscreen.js] ${error} (attempt ${attempt}/${maxRetries})`
				);
			}
		} catch (error) {
			const errorMsg = `setStorage error on attempt ${attempt}: ${error.message}`;
			if (attempt === maxRetries) {
				printDebug(`[offscreen.js] ${errorMsg} (final attempt)`);
				throw new Error(errorMsg);
			}
			printDebug(`[offscreen.js] ${errorMsg}, retrying...`);
		}

		// Exponential backoff with jitter
		const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 50;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
};

// Singleton event system for AudioManager
const callbacks = {};
function addEventListener(event, callback) {
	if (!callbacks[event]) callbacks[event] = [];
	callbacks[event].push(callback);
}

// Register all relevant event handlers for AudioManager
const badgeEvents = [
	'hourMusic',
	'kkStart',
	'gameChange',
	'weatherChange',
	'pause',
	'tabAudio',
	'musicFailed',
];
// registers event listeners during construction
AudioManager(
	addEventListener,
	function () {
		// Check enableTownTune setting from chrome.storage.sync
		// Since this is a synchronous callback, we'll cache the value
		return globalThis.enableTownTuneCache !== undefined
			? globalThis.enableTownTuneCache
			: true;
	},
	function (event, args, source) {
		notifyOffscreenListeners(event, args, source);
	}
);

// Initialize town tune setting cache using message-based storage
(async function initializeTownTuneCache() {
	try {
		const result = await globalThis.getStorage('sync', ['enableTownTune']);
		globalThis.enableTownTuneCache =
			result.enableTownTune !== undefined ? result.enableTownTune : true;
		printDebug(
			'[offscreen.js] Town tune setting initialized:',
			globalThis.enableTownTuneCache
		);
	} catch (error) {
		printDebug('[offscreen.js] Failed to initialize town tune setting:', error);
		globalThis.enableTownTuneCache = true; // Default fallback
	}
})();

// Register handlers for all events that may be sent from the service worker
function notifyOffscreenListeners(event, args, source) {
	printDebug('[offscreen.js] notifyOffscreenListeners called:', event, args);
	const callbackArr = callbacks[event] || [];
	for (let i = 0; i < callbackArr.length; i++) {
		callbackArr[i](...args);
	}
	// Forward badge-relevant events to service worker (but not if they came from service worker)
	if (source !== false && badgeEvents.includes(event)) {
		chrome.runtime.sendMessage({
			type: event,
			target: 'service-worker',
			data: args,
		});
	}
}
globalThis.notify = notifyOffscreenListeners;

function handleMessages(message) {
	printDebug('[offscreen.js] handleMessages received:', message);
	if (message && message.target === 'offscreen-doc') {
		// Handle storage change notifications from service worker
		if (message.type === 'storageChanged') {
			const { namespace, key, newValue } = message.data;
			if (namespace === 'sync' && key === 'enableTownTune') {
				globalThis.enableTownTuneCache = newValue;
				printDebug(
					'[offscreen.js] Town tune setting updated via storage change:',
					globalThis.enableTownTuneCache
				);
			}
			return;
		}

		if (callbacks[message.type]) {
			printDebug(
				'[offscreen.js] Processing message type:',
				message.type,
				'with data:',
				message.data
			);
			callbacks[message.type].forEach((cb) => cb(...message.data));
		} else {
			printDebug(
				'[offscreen.js] No callback registered for message type:',
				message.type
			);
		}
	} else {
		printDebug(
			'[offscreen.js] Message not targeted for offscreen-doc:',
			message
		);
	}
}

chrome.runtime.onMessage.addListener(handleMessages);
