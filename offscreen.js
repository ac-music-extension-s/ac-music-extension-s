'use strict';

import { AudioManager } from './scripts/background/AudioManager.js';
import { printDebug } from './scripts/background/Utility.js';
import { handleBadgeEvent } from './scripts/background/BadgeManager.js';

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
const audioManager = AudioManager(addEventListener, () => false, function(event, args, source) {
    notifyOffscreenListeners(event, args, source);
});

// Register handlers for all events that may be sent from the service worker

function notifyOffscreenListeners(event, args, source) {
    console.log('[offscreen.js] notifyOffscreenListeners called with:', {event, args, argsType: typeof args, argsLength: Array.isArray(args) ? args.length : 'not array', source});
    const callbackArr = callbacks[event] || [];
    // Always call every callback for the event with ...args (spread array)
    for (let i = 0; i < callbackArr.length; i++) {
        if (Array.isArray(args)) {
            callbackArr[i](...args);
        } else {
            console.warn('[offscreen.js] args is not an array:', args);
            callbackArr[i](args);
        }
    }
    // Only forward badge-relevant events to service worker
    if (source !== false && badgeEvents.includes(event)) {
        console.log('[offscreen.js] notifyOffscreenListeners called for badge event:', event, args, JSON.stringify(args));
        // Temporarily disable badge forwarding to test music playback
        if (Array.isArray(args) && args.length > 0) {
            try {
                chrome.runtime.sendMessage({
                    type: event,
                    target: 'service-worker',
                    data: args
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.warn('[offscreen.js] Could not send badge event to service-worker:', chrome.runtime.lastError.message);
                    } else {
                        console.log('[offscreen.js] Badge event sent to service-worker, response:', response);
                    }
                });
            } catch (e) {
                console.warn('[offscreen.js] Exception sending badge event to service-worker:', e);
            }
        } else {
            console.warn('[offscreen.js] Skipping badge event with invalid args:', event, args);
        }
    }
}
globalThis.notify = notifyOffscreenListeners;


function handleMessages(message, sender, sendResponse) {
    if (message && message.target === 'offscreen-doc') {
        if (callbacks[message.type]) {
            callbacks[message.type].forEach(cb => cb(...message.data));
        }
    } else {
        printDebug('[offscreen.js] No handler registered for', message.type);
    }
}

chrome.runtime.onMessage.addListener(handleMessages);