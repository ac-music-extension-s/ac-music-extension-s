console.log('[service_worker.js] Service worker script loaded and running.');
// Global message logger for debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log('[service_worker.js] GLOBAL MESSAGE RECEIVED:', message);
	// Handle badge events sent from offscreen.js
	const badgeEvents = [
		'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'tabAudio', 'musicFailed'
	];
	if (message && message.target === 'service-worker' && badgeEvents.includes(message.type)) {
		console.log('[service_worker.js] Badge event received:', message.type, message.data);
		if (typeof globalThis.badgeManager !== 'undefined' && globalThis.badgeManager && typeof globalThis.badgeManager.handleEvent === 'function') {
			globalThis.badgeManager.handleEvent(message.type, message.data);
		}
		sendResponse({ status: 'badge updated' });
		return;
	}
	handleMessages(message, sender, sendResponse);
});
import { printDebug, setupOffscreenDocument } from './background/Utility.js' // Globally accessible helper functions
import { NotificationManager } from './background/NotificationManager.js' // Handles notifications
import { StateManager } from './background/StateManager.js' // Manages the current state of the extension
import { BadgeManager } from './background/BadgeManager.js';
// Handles MediaSession (audio metadata) management [moved to offscreen]

'use strict';

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
	var notificationManager = new NotificationManager(stateManager.registerCallback, function() {
		return stateManager.getOption("enableNotifications");
	});
	stateManager.activate();
})();


// Forward playback events to offscreen document
async function handleMessages(message) {
	printDebug('[service_worker.js] handleMessages received:', message);
	if (message.target !== 'service-worker') return;
	// List of badge events
	const badgeEvents = [
		'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'tabAudio', 'musicFailed'
	];
	if (badgeEvents.includes(message.type)) {
		printDebug('[service_worker.js] Handling badge event:', message.type, message.data);
		// Update icon/badge in service worker
		if (typeof globalThis.badgeManager !== 'undefined' && globalThis.badgeManager && typeof globalThis.badgeManager.handleEvent === 'function') {
			globalThis.badgeManager.handleEvent(message.type, message.data);
		}
		// DO NOT forward badge events back to offscreen document
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