// Handles playing hourly music, KK, and the town tune.
/* exported AudioManager */

import { TownTuneManager } from './TownTuneManager.js';
import { MediaSessionManager } from './MediaSessionManager.js';
import { TimeKeeper } from './TimeKeeper.js';
import { printDebug, checkMediaSessionSupport, capitalize, formatHour } from './Utility.js';
import { KKSongList } from './KKSongs.js';
import { loopTimes } from './LoopTimes.js';

'use strict';
export function AudioManager(addEventListener, isTownTune, notifyListenersArg) {

	const notify = notifyListenersArg;

	// if eventsEnabled is true, plays event music when applicable.
	// Only enable after all game's music-folders contain one .ogg sound file for each event
	// (i.e. "halloween.ogg" in newLeaf, AC,)
	// Should also be used for disabling event music for those who have turned them off in the settings, then this  should be false.
	let eventsEnabled = false;

	// If enabled, after 3 seconds, the song will skim to three seconds before
	// the end of the loop time, to easily and quickly test loops.
	let debugLoopTimes = false;

	let audio = document.createElement('audio');
	let killLoopTimeout;
	let killFadeInterval;
	let townTuneManager = new TownTuneManager();
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
		audio.removeEventListener("ended", playKKSong);
		
		let isWeatherChange = (previousWeather && !(previousWeather == weather));
		let noGameChange = previousGame && (previousGame == game)
		let noOtherChangesWeather = (noGameChange && !(isHourChange));
		let noOtherChangesHour = (noGameChange && !(isWeatherChange));
		
		if (isWeatherChange && noOtherChangesWeather) {
			previousWeather = weather;
			previousGame = game;
			playHourSong(game, weather, hour, false, true);
		} else {
			if ((!(isHourChange) && noOtherChangesHour)) return;
			let fadeOutLength = isHourChange ? 3000 : 500;
			fadeOutAudio(fadeOutLength, () => {
				if (isHourChange && isTownTune() && !tabAudioPaused) {
					townTunePlaying = true;
					townTuneManager.playTune(false, () => {
						townTunePlaying = false;
						if (!pausedDuringTownTune) playHourSong(game, weather, hour, false, false);
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

		if (!tabAudioPaused) { audio.currentTime = seekTime; audio.play().then(setLoopTimes).catch(audioPlayError); }
		else notify("pause", [tabAudioPaused]); // Set the badge icon back to the paused state

		function setLoopTimes() {
			// song has started
			started = true;

			// set up loop points if loopTime is set up for this
			// game, hour and weather.
			if (loopTime) {
				printDebug("setting loop times. start:", loopTime.start, "end:", loopTime.end);

				if (debugLoopTimes) {
					delayToLoop = 8;
					setTimeout(() => {
						printDebug("skimming");
						audio.currentTime = loopTime.end - 5;
					}, 3000);
				}

				printDebug("delayToLoop: " + delayToLoop);

				if (killLoopTimeout) killLoopTimeout();
				let loopTimeout = setTimeout(() => {
					printDebug("looping from", audio.currentTime, "to", loopTime.start);
					audio.currentTime = loopTime.start;

					delayToLoop = loopTime.end - loopTime.start;
					setLoopTimes();
				}, delayToLoop * 1000);
				killLoopTimeout = () => {
					printDebug("killing loop timeout");
					clearTimeout(loopTimeout);
					loopTimeout = null;
					killLoopTimeout = null;
				};
			} else printDebug("no loop times found. looping full song")
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
		audio.addEventListener("ended", playKKSong);
		fadeOutAudio(500, playKKSong);

		checkMediaSessionSupport(() => {
			navigator.mediaSession.setActionHandler('nexttrack', playKKSong);
		});
	}

	function playKKSong() {
		audio.onpause = null;

		// Use chrome.storage directly (not .sync) in offscreen context
		const storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage : null;
		const getStorage = storage && storage.sync ? storage.sync : (storage && storage.local ? storage.local : null);
		(getStorage || { get: (o, cb) => cb({ kkSelectedSongsEnable: false, kkSelectedSongs: [] }) }).get({
			kkSelectedSongsEnable: false, kkSelectedSongs: []
		}, (items) => {
			const kkSelectedSongsEnable = items.kkSelectedSongsEnable;
			const kkSelectedSongs = items.kkSelectedSongs;

			let version;
			if (kkVersion == 'both') {
				if (Math.floor(Math.random() * 2) == 0) version = 'live';
				else version = 'aircheck';
			} else version = kkVersion;

			let song;
			if (kkSelectedSongsEnable && kkSelectedSongs.length > 0) {
				song = kkSelectedSongs[Math.floor(Math.random() * kkSelectedSongs.length)];
			} else {
				song = KKSongList[Math.floor(Math.random() * KKSongList.length)];
			}

			audio.src = `https://acmusicext.com/static/kk/${version}/${song}.ogg`;
			audio.play();

			let formattedTitle = `${song.split(' - ')[1]} (${capitalize(version)} Version)`;
			notify("kkMusic", [formattedTitle]);

			mediaSessionManager.updateMetadataKK(formattedTitle, song);
		});
	}

	// clears the loop point timeout and the fadeout
	// interval if one exists
	function clearLoop() {
		if (typeof (killLoopTimeout) === 'function') killLoopTimeout();
		if (typeof (killFadeInterval) === 'function') killFadeInterval();
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
			}
		}
	}

	// If the music is paused via pressing the "close" button in the media session dialogue,
	// then we gracefully handle it rather than going into an invalid state.
	function onPause() {
		if (hourlyChange) hourlyChange = false;
		else {
			notify("pause", [tabAudioPaused]);
			if (killLoopTimeout) killLoopTimeout();
			if (!tabAudioPaused) chrome.storage.local.set({"paused": "true"});
		}
	}

	function setVolume() {
		let newVolume = setVolumeValue;
		if (reducedVolume) newVolume = newVolume * (1 - reduceVolumeValue / 100);

		if (newVolume < 0) newVolume = 0;
		if (newVolume > 1) newVolume = 1;

		audio.volume = newVolume;
	}

	addEventListener("hourMusic", (hour, weather, game, isHourChange) => {
		printDebug('[AudioManager] hourMusic event received:', hour, weather, game, isHourChange);
		playHourlyMusic(hour, weather, game, isHourChange);
	});

	addEventListener("kkStart", (_kkVersion) => {
		printDebug('[AudioManager] kkStart event received:', _kkVersion);
		playKKMusic(_kkVersion);
	});

	addEventListener("gameChange", playHourlyMusic);

	addEventListener("weatherChange", playHourlyMusic);

	addEventListener("pause", () => {
		clearLoop();
		fadeOutAudio(300);
		if (townTunePlaying) pausedDuringTownTune = true;
	});

	addEventListener("volume", newVol => {
		setVolumeValue = newVol;
		setVolume();
	});

	// If a tab starts or stops playing audio
	addEventListener("tabAudio", (audible, tabAudio, reduceValue) => {
		printDebug('[AudioManager] tabAudio event received:', audible, tabAudio, reduceValue);
		if (audible != null) {

			// Handles all cases except for an options switch.
			if (tabAudio == 'pause') {
				if (audible) {
					audio.pause();
					tabAudioPaused = true;
				} else {
					if (audio.paused && (audio.readyState >= 3 || audio.readyState == 0)) {
						if (!townTunePlaying) audio.play();
						tabAudioPaused = false;
						// Get the badge icon updated.
						notify("unpause");
					}
				}
			}

			// Handle play case when audible is true and tabAudio is 'play'
			if (tabAudio == 'play' && audible && audio.paused) {
				printDebug('[AudioManager] Play case: unpausing audio');
				if (audio.readyState >= 3 || audio.readyState == 0) {
					if (!townTunePlaying) {
						audio.play();
						tabAudioPaused = false;
						notify("unpause");
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

	function audioPlayError() {
		notify("musicFailed");
	}
}
