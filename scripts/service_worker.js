import { printDebug, setupOffscreenDocument } from './background/Utility.js' // Globally accessible helper functions
import { StateManager } from './background/StateManager.js' // Manages the current state of the extension
import { BadgeManager } from './background/BadgeManager.js';

'use strict';

// Events that need both badge updates AND audio playback
const badgeAndAudioEvents = [
	'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'tabAudio', 'musicFailed'
];

// Main message handler
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	// Handle badge events sent from offscreen.js (these come with target: 'service-worker')
	if (message && message.target === 'service-worker' && badgeAndAudioEvents.includes(message.type)) {
		if (typeof globalThis.badgeManager !== 'undefined' && globalThis.badgeManager && typeof globalThis.badgeManager.handleEvent === 'function') {
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
		data: [addEventListener, isTownTune]
	});
}

// Instantiate BadgeManager in the global scope so its event handler is always registered
const badgeManager = new BadgeManager(() => {}, true); // Pass dummy callback and enabled=true by default
globalThis.badgeManager = badgeManager;

(async function() {
	var stateManager = new StateManager();
	// Ensure offscreen document is created before AudioManager
	await setupOffscreenDocument('offscreen.html');
	await AudioManager(stateManager.registerCallback, function() {
		return stateManager.getOption("enableTownTune");
	});
	stateManager.activate();
})();

// Forward playback events to offscreen document
async function handleMessages(message) {
	printDebug('[service_worker.js] handleMessages received:', message);
	if (message.target !== 'service-worker') return;
	
	if (badgeAndAudioEvents.includes(message.type)) {
		printDebug('[service_worker.js] Handling badge and audio event:', message.type, message.data);
		// Update icon/badge in service worker
		if (typeof globalThis.badgeManager !== 'undefined' && globalThis.badgeManager && typeof globalThis.badgeManager.handleEvent === 'function') {
			globalThis.badgeManager.handleEvent(message.type, message.data);
		}
		// Forward to offscreen document for audio playback
		printDebug('[service_worker.js] Forwarding', message.type, 'to offscreen-doc for audio playback');
		await setupOffscreenDocument('offscreen.html');
		chrome.runtime.sendMessage({
			type: message.type,
			target: 'offscreen-doc',
			data: message.data
		});
		return;
	}
	// Forward only non-badge events to offscreen document for audio playback
	const offscreenEvents = [
		'volume'
	];
	if (offscreenEvents.includes(message.type)) {
		printDebug('[service_worker.js] Forwarding', message.type, 'to offscreen-doc', message.data);
		await setupOffscreenDocument('offscreen.html');
		chrome.runtime.sendMessage({
			type: message.type,
			target: 'offscreen-doc',
			data: message.data
		});
	} else if (globalThis[message.type]) {
		globalThis[message.type](...message.data)
	} else {
		printDebug(message.type + ' not found')
	}
}