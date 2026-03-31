'use strict';

import { setupOffscreenDocument } from './Utility.js';

export async function ExtAudioContext(...args) {
	if (AudioContext) return new AudioContext(...args);
	else {
		setupOffscreenDocument('offscreen.html');
		return await chrome.runtime.sendMessage({
			type: 'AudioContext',
			target: 'offscreen-doc',
			data: args,
		});
	}
}
