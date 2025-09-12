import { printDebug } from './background/Utility.js' // Globally accessible helper functions
import { NotificationManager } from './background/NotificationManager.js' // Handles notifications
import { StateManager } from './background/StateManager.js' // Manages the current state of the extension
// Handles MediaSession (audio metadata) management [moved to offscreen]

'use strict';

function AudioManager(addEventListener, isTownTune) {
	chrome.runtime.sendMessage({
		type: 'AudioManager',
		target: 'offscreen-doc',
		data: [addEventListener, isTownTune]
	})
}

(function() {
	
	var stateManager = new StateManager();
	var audioManager = new AudioManager(stateManager.registerCallback, function() {
		return stateManager.getOption("enableTownTune");
	});
	var notificationManager = new NotificationManager(stateManager.registerCallback, function() {
		return stateManager.getOption("enableNotifications");
	});
	
	stateManager.activate();
	
})();

async function handleMessages(message) {
	if (message.target !== 'service-worker') return;
	else if (window[message.type]) window[message.type](...message.data)
	else printDebug(message.type + ' not found')
}

chrome.runtime.onMessage.addListener(handleMessages);