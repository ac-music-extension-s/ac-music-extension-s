'use strict';

import { printDebug } from './scripts/background/Utility.js';
import { AudioManager } from './scripts/background/AudioManager.js';

const callbacks = {};
// Events that should change the badge & need forwarding to the service worker
const badgeEvents = [
    'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'tabAudio', 'musicFailed'
];

AudioManager(addEventListener, () => false, function(event, args, source) {
    notifyOffscreenListeners(event, args, source)
});

// Register handlers for all events that may be sent from the service worker
function notifyOffscreenListeners(event, args, source) {
    printDebug('[offscreen.js] notifyOffscreenListeners called:', event, args);
    const callbackArr = callbacks[event] || [];
    // Always call every callback for the event with ...args (spread array)
    for (let i = 0; i < callbackArr.length; i++) {
        callbackArr[i](...args);
    }
    // Forward badge-relevant events to service worker
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
    if (message && message.target === 'offscreen-doc') {
        if (callbacks[message.type]) {
            callbacks[message.type].forEach(cb => cb(...message.data));
        }
    } else {
        printDebug('[offscreen.js] No handler registered for', message.type);
    }
}

chrome.runtime.onMessage.addListener(handleMessages);