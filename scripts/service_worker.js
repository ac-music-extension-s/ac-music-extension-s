import { printDebug, setupOffscreenDocument } from './background/Utility.js'; // Globally accessible helper functions
import { StateManager } from './background/StateManager.js'; // Manages the current state of the extension
import { BadgeManager } from './background/BadgeManager.js';

'use strict';

// Events that need both badge updates AND audio playback
const badgeAndAudioEvents = [
	'hourMusic',
	'kkStart',
	'gameChange',
	'weatherChange',
	'pause',
	'tabAudio',
	'musicFailed',
];

// Main message handler
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	// Handle badge events sent from offscreen.js (these come with target: 'service-worker')
	if (
		message &&
		message.target === 'service-worker' &&
		badgeAndAudioEvents.includes(message.type)
	) {
		if (
			typeof globalThis.badgeManager !== 'undefined' &&
			globalThis.badgeManager &&
			typeof globalThis.badgeManager.handleEvent === 'function'
		) {
			globalThis.badgeManager.handleEvent(message.type, message.data);
		}
		sendResponse({ status: 'badge updated' });
		return;
	}

	// Handle all other messages through main handler
	await handleMessages(message, sender, sendResponse);
});

async function AudioManager(addEventListener, isTownTune) {
	// Ensure the offscreen document exists before sending message
	await setupOffscreenDocument('offscreen.html');
	chrome.runtime.sendMessage({
		type: 'AudioManager',
		target: 'offscreen-doc',
		data: [addEventListener, isTownTune],
	});
}

// Instantiate BadgeManager in the global scope so its event handler is always registered
const badgeManager = new BadgeManager(() => {}, true); // Pass dummy callback and enabled=true by default
globalThis.badgeManager = badgeManager;

// Listen for storage changes and forward relevant updates to offscreen document
chrome.storage.onChanged.addListener(async (changes, namespace) => {
	// Forward enableTownTune changes to offscreen document for cache update
	if (namespace === 'sync' && changes.enableTownTune) {
		try {
			await setupOffscreenDocument('offscreen.html');
			chrome.runtime.sendMessage({
				type: 'storageChanged',
				target: 'offscreen-doc',
				data: {
					namespace,
					key: 'enableTownTune',
					newValue: changes.enableTownTune.newValue,
				},
			});
		} catch (error) {
			printDebug(
				'[service_worker.js] Failed to forward storage change:',
				error
			);
		}
	}
});

(async function () {
	var stateManager = new StateManager();
	// Ensure offscreen document is created before AudioManager
	await setupOffscreenDocument('offscreen.html');
	await AudioManager(stateManager.registerCallback, function () {
		return stateManager.getOption('enableTownTune');
	});
	stateManager.activate();
})();

// Handle storage operations for offscreen document
async function handleStorageRequest(message, sendResponse) {
	try {
		if (message.type === 'getStorage') {
			const { storageType, keys } = message.data;
			const storage =
				storageType === 'local' ? chrome.storage.local : chrome.storage.sync;
			const result = await storage.get(keys);
			printDebug(
				`[service_worker.js] getStorage ${storageType}:`,
				keys,
				'->',
				result
			);

			if (sendResponse) {
				sendResponse({ success: true, data: result });
			}
		} else if (message.type === 'setStorage') {
			const { storageType, data } = message.data;
			const storage =
				storageType === 'local' ? chrome.storage.local : chrome.storage.sync;
			await storage.set(data);
			printDebug(`[service_worker.js] setStorage ${storageType}:`, data);

			if (sendResponse) {
				sendResponse({ success: true });
			}
		}
	} catch (error) {
		printDebug(`[service_worker.js] Storage operation failed:`, error);

		if (sendResponse) {
			sendResponse({ success: false, error: error.message });
		}
	}
}

// Forward playback events to offscreen document
async function handleMessages(message, sender, sendResponse) {
	printDebug('[service_worker.js] handleMessages received:', message);
	if (message.target !== 'service-worker') return;

	// Handle ping requests for service worker readiness
	if (message.type === 'ping') {
		printDebug('[service_worker.js] Ping received, responding with pong');
		if (sendResponse) {
			sendResponse({ success: true, message: 'pong' });
		}
		return true;
	}

	// Handle storage requests
	if (message.type === 'getStorage' || message.type === 'setStorage') {
		await handleStorageRequest(message, sendResponse);
		return true; // Keep channel open for async response
	}

	if (badgeAndAudioEvents.includes(message.type)) {
		printDebug(
			'[service_worker.js] Handling badge and audio event:',
			message.type,
			message.data
		);
		// Update icon/badge in service worker
		if (
			typeof globalThis.badgeManager !== 'undefined' &&
			globalThis.badgeManager &&
			typeof globalThis.badgeManager.handleEvent === 'function'
		) {
			globalThis.badgeManager.handleEvent(message.type, message.data);
		}
		// Forward to offscreen document for audio playback
		printDebug(
			'[service_worker.js] Forwarding',
			message.type,
			'to offscreen-doc for audio playback'
		);
		await setupOffscreenDocument('offscreen.html');
		chrome.runtime.sendMessage({
			type: message.type,
			target: 'offscreen-doc',
			data: message.data,
		});
		return;
	}
	// Forward only non-badge events to offscreen document for audio playback
	const offscreenEvents = ['volume'];
	if (offscreenEvents.includes(message.type)) {
		printDebug(
			'[service_worker.js] Forwarding',
			message.type,
			'to offscreen-doc',
			message.data
		);
		await setupOffscreenDocument('offscreen.html');
		chrome.runtime.sendMessage({
			type: message.type,
			target: 'offscreen-doc',
			data: message.data,
		});
	} else if (globalThis[message.type]) {
		globalThis[message.type](...message.data);
	} else {
		printDebug(message.type + ' not found');
	}
}
