// Handles playing town tunes, could potentially be either folded
// into AudioManager, or tune_player instead of making createSampler
// and createTunePlayer globally accessable.

'use strict';

import { createSampler, createTunePlayer } from '../global/tune_player.js';

export function TownTuneManager() {
	// var defaultTune = ["C2", "E2", "C2", "G1", "F1", "G1", "B1", "D2", "C2", "zZz", "G1", "zZz", "C2", "-", "-", "zZz"];
	var defaultTune = [
		'C3',
		'E3',
		'C3',
		'G2',
		'F2',
		'G2',
		'B2',
		'D3',
		'C3',
		'zZz',
		'?',
		'zZz',
		'C3',
		'-',
		'-',
		'zZz',
	];
	var defaultTownTuneVolume = 0.75;
	var defaultTabAudio = 'pause';
	var defaultTabAudioReduceVolume = 80;

	// Check if AudioContext is available (not available in background/service worker)
	var audioContext = null;
	var sampler = null;
	var tunePlayer = null;

	if (typeof AudioContext !== 'undefined') {
		audioContext = new AudioContext();
		sampler = createSampler(audioContext);
		tunePlayer = createTunePlayer(audioContext);
	}

	// Play tune and call doneCB after it's done
	this.playTune = async function (tabAudioPlaying = false, doneCB) {
		// If AudioContext is not available (e.g., in background script),
		// we can't play audio directly. In this case, just call the callback.
		if (!audioContext || !tunePlayer || !sampler) {
			if (doneCB) doneCB();
			return;
		}

		try {
			// Get storage functions from global scope (provided by offscreen.js)
			const getStorage = globalThis.getStorage;

			if (!getStorage) {
				console.error(
					'[TownTuneManager] getStorage not available, using defaults'
				);
				tunePlayer
					.playTune(defaultTune, sampler, 66, defaultTownTuneVolume)
					.done(doneCB);
				return;
			}

			// Get storage settings with fallback to defaults
			let townTune = defaultTune;
			let tabAudio = defaultTabAudio;
			let tabAudioReduceValue = defaultTabAudioReduceVolume;
			let volume = defaultTownTuneVolume;

			// Add a small delay to ensure service worker is ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			try {
				// Get sync storage settings
				const syncItems = await getStorage('sync', [
					'townTune',
					'tabAudio',
					'tabAudioReduceValue',
				]);
				townTune = syncItems.townTune || defaultTune;
				tabAudio = syncItems.tabAudio || defaultTabAudio;
				tabAudioReduceValue =
					syncItems.tabAudioReduceValue || defaultTabAudioReduceVolume;
			} catch (syncError) {
				console.warn(
					'[TownTuneManager] Failed to get sync storage, using defaults:',
					syncError
				);
			}

			try {
				// Get local storage settings
				const localItems = await getStorage('local', ['townTuneVolume']);
				volume =
					localItems.townTuneVolume >= 0 && localItems.townTuneVolume !== null
						? localItems.townTuneVolume
						: defaultTownTuneVolume;
			} catch (localError) {
				console.warn(
					'[TownTuneManager] Failed to get local storage, using default volume:',
					localError
				);
			}

			// Reduce the volume when necessary
			if (tabAudio == 'reduce' && tabAudioPlaying)
				volume = volume * (1 - tabAudioReduceValue / 100);
			if (volume < 0) volume = 0;
			if (volume > 1) volume = 1;

			tunePlayer.playTune(townTune, sampler, 66, volume).done(doneCB);
		} catch (error) {
			console.error('[TownTuneManager] Unexpected error in playTune:', error);
			// Fallback to defaults if anything fails
			tunePlayer
				.playTune(defaultTune, sampler, 66, defaultTownTuneVolume)
				.done(doneCB);
		}
	};
}
