'use strict';

import { AudioManager } from './scripts/background/AudioManager.js';
import { printDebug } from './scripts/background/Utility.js';

// Singleton event system for AudioManager
const callbacks = {};
function addEventListener(event, callback) {
    if (!callbacks[event]) callbacks[event] = [];
    callbacks[event].push(callback);
}

// Register all relevant event handlers for AudioManager
const badgeEvents = [
    'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'tabAudio', 'musicFailed'
];
// registers event listeners during construction
AudioManager(addEventListener, () => false, function(event, args, source) {
    notifyOffscreenListeners(event, args, source)
});

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
            data: args
        });
    }
}
globalThis.notify = notifyOffscreenListeners;


function handleMessages(message, _sender, _sendResponse) {
    printDebug('[offscreen.js] handleMessages received:', message);
    if (message && message.target === 'offscreen-doc') {
        if (callbacks[message.type]) {
            printDebug('[offscreen.js] Processing message type:', message.type, 'with data:', message.data);
            callbacks[message.type].forEach(cb => cb(...message.data));
        } else {
            printDebug('[offscreen.js] No callback registered for message type:', message.type);
        }
    } else {
        printDebug('[offscreen.js] Message not targeted for offscreen-doc:', message);
    }
}

chrome.runtime.onMessage.addListener(handleMessages);