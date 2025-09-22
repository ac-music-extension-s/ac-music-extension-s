// Globally accessible helper functions
'use strict';
// Enable this to get debug logs, disabled for production
export var DEBUG_FLAG = true;

// Returns a hour-formatted string of a time
export function formatHour(time) {
	if (time == -1) {
		return '';
	}
	if (time == 0) {
		return '12am';
	}
	if (time == 12) {
		return '12pm';
	}
	if (time < 13) {
		return time + 'am';
	}
	return time - 12 + 'pm';
}

export function printDebug(...args) {
	if (DEBUG_FLAG) console.log(...args);
}

// Returns a copy of this string having its first letter uppercased
export function capitalize(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getLocalUrl(relativePath) {
	return chrome.runtime.getURL(relativePath);
}

var supportsMediaSession = typeof navigator.mediaSession !== 'undefined';
export function checkMediaSessionSupport(lambda) {
	if (supportsMediaSession) lambda();
}

let creating; // A global promise to avoid concurrency issues
export async function setupOffscreenDocument(path) {
	// Check all windows controlled by the service worker to see if one
	// of them is the offscreen document with the given path
	const existingContexts = await chrome.runtime.getContexts({
		contextTypes: ['OFFSCREEN_DOCUMENT'],
		documentUrls: [chrome.runtime.getURL(path)],
	});

	if (existingContexts.length > 0) {
		return;
	}

	// create offscreen document
	if (creating) {
		await creating;
	} else {
		creating = chrome.offscreen.createDocument({
			url: path,
			reasons: ['AUDIO_PLAYBACK'],
			justification: 'To play music or town tunes',
		});
		await creating;
		creating = null;
	}
}
