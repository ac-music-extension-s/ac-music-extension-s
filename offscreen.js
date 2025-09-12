'use strict';
import { printDebug } from './background/Utility.js' // Globally accessible helper functions

function notifyListeners(event, args, source) {
    if (!options.paused || event === "pause" || event === "volume") {
        var callbackArr = callbacks[event] || [];
        for (var i = 0; i < callbackArr.length; i++) {
            callbackArr[i].apply(window, args);
        }
        printDebug("Notified listeners of " + event + " with args: " + args);
    }
    if (source !== false) {
        chrome.runtime.sendMessage({
            type: 'notifyListeners',
            target: 'service-worker',
            data: [event, args, false]
        })
    }
};
window.notify = notifyListeners;

import { AudioManager } from './scripts/background/AudioManager.js' // Handles playing hourly music, KK, and the town tune.

async function handleMessages(message) {
    if (message.target !== 'offscreen-doc') return;
    else if (message.type == 'AudioManager') new AudioManager(...message.data)
    else if (window[message.type]) window[message.type](...message.data)
    else printDebug(message.type + ' not found')
}

chrome.runtime.onMessage.addListener(handleMessages);