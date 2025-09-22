// Handles playing hourly music, KK, and the town tune.
/* exported AudioManager */

import { TownTuneManager } from './TownTuneManager.js';
import { MediaSessionManager } from './MediaSessionManager.js';
import { TimeKeeper } from './TimeKeeper.js';
import {
	printDebug,
	checkMediaSessionSupport,
	capitalize,
	formatHour,
} from './Utility.js';
import { KKSongList } from './KKSongs.js';
import { loopTimes } from './LoopTimes.js';

('use strict');
export function AudioManager(addEventListener, isTownTune, notifyListenersArg) {
	const notify = notifyListenersArg;

	// Storage functions for offscreen context
	const getStorage = globalThis.getStorage;
	const setStorage = globalThis.setStorage;

	// if eventsEnabled is true, plays event music when applicable.
	// Only enable after all game's music-folders contain one .ogg sound file for each event
	// (i.e. "halloween.ogg" in newLeaf, AC,)
	// Should also be used for disabling event music for those who have turned them off in the settings, then this should be false.
	// eslint-disable-next-line no-unused-vars
	let eventsEnabled = false;

	// If enabled, after 3 seconds, the song will skim to three seconds before
	// the end of the loop time, to easily and quickly test loops.
	let debugLoopTimes = false;

	let audio = document.createElement('audio');
	let killLoopTimeout;
	let killFadeInterval;
	let townTuneManager = new TownTuneManager();
	// eslint-disable-next-line no-unused-vars
	let timeKeeper = new TimeKeeper();
	let mediaSessionManager = new MediaSessionManager();
	let kkVersion;
	let previousWeather;
	let previousGame;

	let hourlyChange = false;
	let townTunePlaying = false;

	let setVolumeValue;
	let reduceVolumeValue = 0;
	let reducedVolume = false;
	let tabAudioPaused = false;
	let pausedDuringTownTune = false;

	// isHourChange is true if it's an actual hour change,
	// false if we're activating music in the middle of an hour
	function playHourlyMusic(hour, weather, game, isHourChange) {
		clearLoop();
		audio.loop = true;
		audio.removeEventListener('ended', playKKSong);

		let isWeatherChange = previousWeather && !(previousWeather == weather);
		let noGameChange = previousGame && previousGame == game;
		let noOtherChangesWeather = noGameChange && !isHourChange;
		let noOtherChangesHour = noGameChange && !isWeatherChange;

		if (isWeatherChange && noOtherChangesWeather) {
			previousWeather = weather;
			previousGame = game;
			playHourSong(game, weather, hour, false, true);
		} else {
			if (!isHourChange && noOtherChangesHour) return;
			let fadeOutLength = isHourChange ? 3000 : 500;
			fadeOutAudio(fadeOutLength, () => {
				const townTuneEnabled = isTownTune();
				printDebug(
					'[AudioManager] Hour change - townTuneEnabled:',
					townTuneEnabled,
					'tabAudioPaused:',
					tabAudioPaused
				);
				if (isHourChange && townTuneEnabled && !tabAudioPaused) {
					printDebug('[AudioManager] Playing town tune...');
					townTunePlaying = true;
					townTuneManager.playTune(false, () => {
						printDebug('[AudioManager] Town tune finished');
						townTunePlaying = false;
						if (!pausedDuringTownTune)
							playHourSong(game, weather, hour, false, false);
						else pausedDuringTownTune = false;
					});
				} else {
					previousWeather = weather;
					previousGame = game;
					playHourSong(game, weather, hour, false, false);
				}
			});
		}

		checkMediaSessionSupport(() => {
			navigator.mediaSession.setActionHandler('nexttrack', null);
		});
	}

	// Plays a song for an hour, setting up loop times if any exist
	function playHourSong(game, weather, hour, skipIntro, started) {
		audio.loop = true;

		let seekTime = 0;
		if (started) seekTime = audio.currentTime;

		// STANDARD SONG NAME FORMATTING
		let songName = formatHour(hour);

		// EVENT SONG NAME FORMATTING
		// TODO: Re-enable events after adding necessary files.
		// TODO: Fetch eventsEnabled from user options instead of local boolean.
		/*if(eventsEnabled && timeKeeper.getEvent() !== "none"){ //getEvent() returns eventname, or "none".
			// Changing the song name to the name of the event, if an event is ongoing.
			songName = timeKeeper.getEvent();
		}*/

		// SETTING AUDIO SOURCE
		audio.src = `https://acmusicext.com/static/${game}/${weather}/${songName}.ogg`;

		let loopTime = ((loopTimes[game] || {})[weather] || {})[hour];
		let delayToLoop;

		if (loopTime) {
			delayToLoop = loopTime.end;

			if (skipIntro) {
				audio.currentTime = loopTime.start;
				delayToLoop -= loopTime.start;
			}
		}

		audio.onpause = onPause;

		setVolume();

		audio.onplay = () => {
			// If we resume mid-song, then we recalculate the delayToLoop
			if (started && loopTime) {
				delayToLoop = loopTime.end;
				delayToLoop -= audio.currentTime;
				setLoopTimes();
			}
		};

		if (!tabAudioPaused) {
			audio.currentTime = seekTime;
			audio.play().then(setLoopTimes).catch(audioPlayError);
		} else notify('pause', [tabAudioPaused]); // Set the badge icon back to the paused state

		function setLoopTimes() {
			// song has started
			started = true;

			// set up loop points if loopTime is set up for this
			// game, hour and weather.
			if (loopTime) {
				printDebug(
					'setting loop times. start:',
					loopTime.start,
					'end:',
					loopTime.end
				);

				if (debugLoopTimes) {
					delayToLoop = 8;
					setTimeout(() => {
						printDebug('skimming');
						audio.currentTime = loopTime.end - 5;
					}, 3000);
				}

				printDebug('delayToLoop: ' + delayToLoop);

				if (killLoopTimeout) killLoopTimeout();
				let loopTimeout = setTimeout(() => {
					printDebug('looping from', audio.currentTime, 'to', loopTime.start);
					audio.currentTime = loopTime.start;

					delayToLoop = loopTime.end - loopTime.start;
					setLoopTimes();
				}, delayToLoop * 1000);
				killLoopTimeout = () => {
					printDebug('killing loop timeout');
					clearTimeout(loopTimeout);
					loopTimeout = null;
					killLoopTimeout = null;
				};
			} else printDebug('no loop times found. looping full song');
		}

		mediaSessionManager.updateMetadata(game, hour, weather);
	}

	function playKKMusic(_kkVersion) {
		printDebug('[AudioManager] playKKMusic called with version:', _kkVersion);
		kkVersion = _kkVersion;
		clearLoop();
		audio.loop = false;
		audio.onplay = null;
		audio.onpause = onPause;
		audio.addEventListener('ended', playKKSong);
		fadeOutAudio(500, playKKSong);

		checkMediaSessionSupport(() => {
			navigator.mediaSession.setActionHandler('nexttrack', playKKSong);
		});
	}

	async function playKKSong() {
		audio.onpause = null;

		try {
			// Use message-based storage access for offscreen context
			const items = await getStorage('sync', [
				'kkSelectedSongsEnable',
				'kkSelectedSongs',
			]);
			const kkSelectedSongsEnable = items.kkSelectedSongsEnable || false;
			const kkSelectedSongs = items.kkSelectedSongs || [];

			let version;
			if (kkVersion == 'both') {
				if (Math.floor(Math.random() * 2) == 0) version = 'live';
				else version = 'aircheck';
			} else version = kkVersion;

			let song;
			if (kkSelectedSongsEnable && kkSelectedSongs.length > 0) {
				song =
					kkSelectedSongs[Math.floor(Math.random() * kkSelectedSongs.length)];
			} else {
				song = KKSongList[Math.floor(Math.random() * KKSongList.length)];
			}

			audio.src = `https://acmusicext.com/static/kk/${version}/${song}.ogg`;
			audio.play().catch(audioPlayError);

			let formattedTitle = `${song.split(' - ')[1]} (${capitalize(version)} Version)`;
			notify('kkMusic', [formattedTitle]);

			mediaSessionManager.updateMetadataKK(formattedTitle, song);
		} catch (error) {
			printDebug('[AudioManager] playKKSong storage error:', error);
			// Fallback to random song if storage fails
			let version =
				kkVersion === 'both'
					? Math.floor(Math.random() * 2) == 0
						? 'live'
						: 'aircheck'
					: kkVersion;
			let song = KKSongList[Math.floor(Math.random() * KKSongList.length)];

			audio.src = `https://acmusicext.com/static/kk/${version}/${song}.ogg`;
			audio.play().catch(audioPlayError);

			let formattedTitle = `${song.split(' - ')[1]} (${capitalize(version)} Version)`;
			notify('kkMusic', [formattedTitle]);

			mediaSessionManager.updateMetadataKK(formattedTitle, song);
		}
	}

	// clears the loop point timeout and the fadeout
	// interval if one exists
	function clearLoop() {
		if (typeof killLoopTimeout === 'function') killLoopTimeout();
		if (typeof killFadeInterval === 'function') killFadeInterval();
	}

	// Fade out audio and call callback when finished.
	function fadeOutAudio(time, callback) {
		if (audio.paused) {
			if (callback) callback();
		} else {
			let oldVolume = audio.volume;
			let step = audio.volume / (time / 100.0);
			let fadeInterval = setInterval(() => {
				if (audio.volume > step) {
					audio.volume -= step;
				} else {
					clearInterval(fadeInterval);
					hourlyChange = true;
					audio.pause();
					audio.volume = oldVolume;
					if (callback) callback();
				}
			}, 100);
			killFadeInterval = function () {
				clearInterval(fadeInterval);
				audio.volume = oldVolume;
				killFadeInterval = null;
			};
		}
	}

	// If the music is paused via pressing the "close" button in the media session dialogue,
	// then we gracefully handle it rather than going into an invalid state.
	function onPause() {
		if (hourlyChange) hourlyChange = false;
		else {
			notify('pause', [tabAudioPaused]);
			if (killLoopTimeout) killLoopTimeout();
			if (!tabAudioPaused) {
				setStorage('local', { paused: 'true' }).catch((error) => {
					printDebug('[AudioManager] Failed to save pause state:', error);
				});
			}
		}
	}

	function setVolume() {
		let newVolume = setVolumeValue;
		if (reducedVolume) newVolume = newVolume * (1 - reduceVolumeValue / 100);

		if (newVolume < 0) newVolume = 0;
		if (newVolume > 1) newVolume = 1;

		audio.volume = newVolume;
	}

	addEventListener('hourMusic', (hour, weather, game, isHourChange) => {
		printDebug(
			'[AudioManager] hourMusic event received:',
			hour,
			weather,
			game,
			isHourChange
		);
		playHourlyMusic(hour, weather, game, isHourChange);
	});

	addEventListener('kkStart', (_kkVersion) => {
		printDebug('[AudioManager] kkStart event received:', _kkVersion);
		playKKMusic(_kkVersion);
	});

	addEventListener('gameChange', playHourlyMusic);

	addEventListener('weatherChange', playHourlyMusic);

	addEventListener('pause', () => {
		clearLoop();
		fadeOutAudio(300);
		if (townTunePlaying) pausedDuringTownTune = true;
	});

	addEventListener('volume', (newVol) => {
		printDebug('[AudioManager] Volume event received:', newVol);
		setVolumeValue = newVol;
		setVolume();
		printDebug(
			'[AudioManager] Volume updated, audio.volume is now:',
			audio.volume
		);
	});

	// If a tab starts or stops playing audio
	addEventListener('tabAudio', (audible, tabAudio, reduceValue) => {
		printDebug(
			'[AudioManager] tabAudio event received:',
			audible,
			tabAudio,
			reduceValue
		);
		if (audible != null) {
			// Handles all cases except for an options switch.
			if (tabAudio == 'pause') {
				if (audible) {
					audio.pause();
					tabAudioPaused = true;
				} else {
					if (
						audio.paused &&
						(audio.readyState >= 3 || audio.readyState == 0)
					) {
						if (!townTunePlaying) audio.play().catch(audioPlayError);
						tabAudioPaused = false;
						// Get the badge icon updated.
						notify('unpause');
					}
				}
			}

			// Handle play case when audible is true and tabAudio is 'play'
			if (tabAudio == 'play' && audible && audio.paused) {
				printDebug('[AudioManager] Play case: unpausing audio');
				if (audio.readyState >= 3 || audio.readyState == 0) {
					if (!townTunePlaying) {
						audio.play().catch(audioPlayError);
						tabAudioPaused = false;
						notify('unpause');
					}
				}
			}

			if (tabAudio == 'reduce') {
				if (audible) {
					reduceVolumeValue = reduceValue;
					reducedVolume = true;
					setVolume();
				} else {
					reducedVolume = false;
					setVolume();
				}
			}
		}
	});

	audio.onerror = audioPlayError;

	function audioPlayError(error) {
		if (error && error.name === 'AbortError') {
			printDebug(
				'[AudioManager] Play request was aborted (normal during pause/unpause)'
			);
			return;
		}

		if (error) {
			printDebug('[AudioManager] Audio play error:', error.name, error.message);
		}

		if (!error || error.name !== 'AbortError') {
			notify('musicFailed');
		}
	}

	// Initialize volume from storage via service worker
	(async function initializeVolume() {
		try {
			const result = await getStorage('local', ['volume']);
			printDebug('[AudioManager] Initializing volume from storage:', result);
			if (result.volume !== undefined && result.volume >= 0) {
				setVolumeValue = parseFloat(result.volume);
			} else {
				setVolumeValue = 0.5; // Default volume
			}
			printDebug('[AudioManager] Initial volume set to:', setVolumeValue);
			// Apply the volume if audio is ready
			if (audio.volume !== undefined) {
				setVolume();
			}
		} catch (error) {
			printDebug(
				'[AudioManager] Storage access failed, using default volume:',
				error
			);
			setVolumeValue = 0.5; // Default volume if storage fails
		}
	})();
}
