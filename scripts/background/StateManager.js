// Manages the current state of the extension, views can register to it
// and it will notify certain events.

'use strict';
import { printDebug, checkMediaSessionSupport, setupOffscreenDocument } from './Utility.js';
import { TimeKeeper } from './TimeKeeper.js';
import { WeatherManager } from './WeatherManager.js';
import { BadgeManager } from './BadgeManager.js';
import { TabAudioHandler } from './TabAudioHandler.js';
import { TownTuneManager } from './TownTuneManager.js';

export function StateManager() {
	let self;
	self = this;

	let options;
	options = {};

	let callbacks;
	callbacks = {};

	let timeKeeper = new TimeKeeper();
	let tabAudio = new TabAudioHandler();
	let townTuneManagerAvailable = false;
	let townTuneManager = null;
	if (!chrome.offscreen) {
		townTuneManagerAvailable = true;
		townTuneManager = new TownTuneManager();
	}
	let badgeManager;
	let weatherManager;
	let isKKTime;
	let startup = true;
	let browserClosed = false;

	if (chrome.action) chrome.browserAction = chrome.action;

	this.registerCallback = function (event, callback) {
		callbacks[event] = callbacks[event] || [];
		callbacks[event].push(callback);
	};

	this.getOption = function (option) {
		return options[option];
	};

	this.activate = function () {
		printDebug("Activating StateManager");

		isKKTime = timeKeeper.getDay() == 6 && timeKeeper.getHour() >= 20;
		getSyncedOptions(() => {
			if (!badgeManager) badgeManager = new BadgeManager(this.registerCallback, options.enableBadgeText);

			if (!weatherManager) {
				weatherManager = new WeatherManager(options.zipCode, options.countryCode);
				weatherManager.registerChangeCallback(() => {
					if (!isKK() && isLive()) {
						let musicAndWeather = getMusicAndWeather();
						// Sends a different event on startup to get the "hourMusic" desktop notification.
						if (startup) {
							notifyListeners("hourMusic", [timeKeeper.getHour(), musicAndWeather.weather, musicAndWeather.music, false], callbacks, options);
							startup = false;
						} else notifyListeners("weatherChange", [timeKeeper.getHour(), musicAndWeather.weather, musicAndWeather.music, false], callbacks, options);
					}
				});
			}
			notifyListeners("volume", [options.volume], callbacks, options);
			if (isKK()) notifyListeners("kkStart", [options.kkVersion], callbacks, options);
			else {
				let musicAndWeather = getMusicAndWeather();
				if (musicAndWeather.weather) notifyListeners("hourMusic", [timeKeeper.getHour(), musicAndWeather.weather, musicAndWeather.music, false], callbacks, options);
			}
			if (!tabAudio.activated) {
				tabAudio.registerCallback(audible => {
					notifyListeners("tabAudio", [audible, options.tabAudio, options.tabAudioReduceValue], callbacks, options);
				});
				tabAudio.activate();
			} else {
				tabAudio.checkTabs(true);
			}
		});
	};

	function isKK() {
		return options.alwaysKK || (options.enableKK && isKKTime);
	}

	function isLive() {
		return options.weather == 'live';
	}

	// Retrieves all synced options, which are then stored in the 'options' variable
	// Default values to use if absent are specified
	function getSyncedOptions(callback) {
		chrome.storage.sync.get({
			volume: 0.5,
			music: 'new-horizons',
			weather: 'sunny',
			enableNotifications: true,
			enableKK: true,
			alwaysKK: false,
			kkVersion: 'live',
			paused: false,
			enableTownTune: true,
			absoluteTownTune: false,
			townTuneVolume: 0.75,
			//enableAutoPause: false,
			zipCode: "98052",
			countryCode: "us",
			enableBadgeText: true,
			tabAudio: 'pause',
			enableBackground: false,
			tabAudioReduceValue: 80,
			kkSelectedSongsEnable: false,
			kkSelectedSongs: []
		}, items => {
			chrome.storage.local.get({ 
				paused: items.paused,
				volume: items.volume,
				townTuneVolume: items.townTuneVolume 
			}, localItems => {
				items.paused = localItems.paused === true;
				items.volume = (localItems.volume >= 0 && localItems.volume !== null) ? localItems.volume : 0.5;
				items.townTuneVolume = (localItems.townTuneVolume >= 0 && localItems.townTuneVolume !== null) ? localItems.volume : 0.75;
				options = items;
				if (typeof callback === 'function') callback();
			});
		});
	}

	// Gets the current game based on the option, and weather if
	// we're using a live weather option.
	function getMusicAndWeather() {
		let data = {
			music: options.music,
			weather: options.weather
		};

		if (options.music === "game-random") {
			let games = [
				'animal-crossing',
				'wild-world',
				'new-leaf',
				'new-horizons'
			];

			data.music = games[Math.floor(Math.random() * games.length)];
		}

		if (isLive()) {
			if (!weatherManager.getWeather()) data.weather = null;
			else if (weatherManager.getWeather() == "Rain") data.weather = 'raining';
			else if (weatherManager.getWeather() == "Snow") data.weather = 'snowing';
			else data.weather = "sunny";
		} else if (options.weather == 'weather-random') {
			let weathers = [
				'sunny',
				'raining',
				'snowing'
			];

			data.weather = weathers[Math.floor(Math.random() * weathers.length)];
		}

		// If the weather is meant to be raining, and the chosen game is animal crossing, then we
		// override the weather to be snowing since there is no raining music for animal crossing.
		if (data.weather == 'raining' && data.music == 'animal-crossing') data.weather = 'snowing';

		return data;
	}

	// If we're not playing KK, let listeners know the hour has changed
	// If we enter KK time, let listeners know
	timeKeeper.registerHourlyCallback((day, hour) => {
		let wasKK = isKK();
		isKKTime = day == 6 && hour >= 20;
		if (isKK() && !wasKK) notifyListeners("kkStart", [options.kkVersion], callbacks, options);
		else if (!isKK()) {
			let musicAndWeather = getMusicAndWeather();
			notifyListeners("hourMusic", [hour, musicAndWeather.weather, musicAndWeather.music, true], callbacks, options);
			// Play hourly tune when paused, but only if town tune is enabled
			if (options.paused && (options.absoluteTownTune && options.enableTownTune)) {
				if (chrome.offscreen) {
					setupOffscreenDocument('offscreen.html');
					chrome.runtime.sendMessage({
						type: 'townTuneManager.playTune',
						target: 'offscreen-doc',
						data: [tabAudio.audible]
					});
				} else {
					townTuneManager.playTune(tabAudio.audible);
				}
			}
		}
	});

	// 'Updated options' listener callback
	// Detects that the user has updated an option
	// Updates the 'options' variable and notifies listeners of any pertinent changes
	let storageListener = (changes) => {
		// Firefox handles onChanged weirdly and provides *everything*, regardless
		// of whether or not it changed. To make it be handled more like Chromium-based
		// browsers, and make the rest of this code more readable, this goes through 
		// everything in the "changes" object and deletes items in it if both values 
		// are the same.
		Object.keys(changes).forEach((change) => { 
			if (changes[change].oldValue == changes[change].newValue) delete changes[change];
			else {
				if (Array.isArray(changes[change].oldValue) && Array.isArray(changes[change].newValue)) {
					if (changes[change].oldValue.every(item => changes[change].newValue.includes(item)) && changes[change].newValue.every(item => changes[change].oldValue.includes(item))) delete changes[change];
				}
			}
		})
		
		   printDebug('A data object has been updated: ', changes)
		   let wasKK = isKK();
		   let prevKKVersion = options.kkVersion;
		   let oldTabAudio = self.getOption("tabAudio");
		   let oldTabAudioReduce = self.getOption("tabAudioReduceValue");
		   let oldBadgeTextEnabled = self.getOption("enableBadgeText");
		   if ('volume' in changes) notifyListeners("volume", [changes.volume.newValue], callbacks, options);
		   getSyncedOptions(() => {
			   let nowKK = isKK();
			   let musicAndWeather = getMusicAndWeather();
			   // Always send gameChange with up-to-date info
			   notifyListeners("gameChange", [timeKeeper.getHour(), musicAndWeather.weather, musicAndWeather.music], callbacks, options);
			   if ('countryCode' in changes) weatherManager.setCountry(changes.countryCode.newValue);
			   if ('volume' in changes) notifyListeners("volume", [changes.volume.newValue], callbacks, options);
			   // If we just entered KK mode, or KK version changed while in KK, or KK song selection changed while in KK
			   if ((nowKK && !wasKK) || (prevKKVersion != options.kkVersion && nowKK) || (("kkSelectedSongsEnable" in changes || "kkSelectedSongs" in changes) && nowKK)) {
				   notifyListeners("kkStart", [options.kkVersion], callbacks, options);
			   }
			   // If we just left KK mode, send hourMusic
			   if (!nowKK && wasKK) {
				   let musicAndWeather2 = getMusicAndWeather();
				   notifyListeners("hourMusic", [timeKeeper.getHour(), musicAndWeather2.weather, musicAndWeather2.music, false], callbacks, options);
			   }
			   // If music or weather changed and not in KK, send hourMusic
			   if (("music" in changes || "weather" in changes) && !nowKK) {
				   let musicAndWeather3 = getMusicAndWeather();
				   notifyListeners("hourMusic", [timeKeeper.getHour(), musicAndWeather3.weather, musicAndWeather3.music, false], callbacks, options);
			   }
			   if (oldTabAudio != options.tabAudio || oldTabAudioReduce != options.tabAudioReduceValue) notifyListeners("tabAudio", [null, options.tabAudio, options.tabAudioReduceValue], callbacks, options);
			   if (oldBadgeTextEnabled != options.enableBadgeText) badgeManager.updateEnabled(options.enableBadgeText);
		   });
	};
	chrome.storage.onChanged.addListener(storageListener)
	addEventListener("storage", changes => {
		var changesObj = {}
		changesObj[changes['key']] = {}
		changesObj[changes['key']]['newValue'] = changes['newValue']
		changesObj[changes['key']]['oldValue'] = changes['oldValue']
		storageListener(changesObj)
	})

	// play/pause when user clicks the extension icon
	chrome.browserAction.onClicked.addListener(toggleMusic);

	// play/pause when the browser closes and the option to play in background is disabled
	chrome.tabs.onCreated.addListener(checkTabs);
	setInterval(checkTabs, 1000);

	tabAudio.registerCallback(audible => {
		notifyListeners("tabAudio", [audible, options.tabAudio, options.tabAudioReduceValue], callbacks, options);
	});

	// Handle the user interactions in the media session dialogue.
	checkMediaSessionSupport(() => {
		navigator.mediaSession.setActionHandler('play', toggleMusic);
		navigator.mediaSession.setActionHandler('pause', toggleMusic);
	});

	function toggleMusic() {
		chrome.storage.local.set({ paused: !options.paused });
		getSyncedOptions(() => {
			// options.paused is now up-to-date
			if (options.paused) {
				notifyListeners("pause", [], callbacks, options);
				notifyListeners("tabAudio", [false, "pause", options.tabAudioReduceValue], callbacks, options);
			} else {
				notifyListeners("tabAudio", [true, "play", options.tabAudioReduceValue], callbacks, options);
				// Also notify hourMusic to trigger playback
				let musicAndWeather = getMusicAndWeather();
				notifyListeners("hourMusic", [timeKeeper.getHour(), musicAndWeather.weather, musicAndWeather.music, false], callbacks, options);
				// Do NOT call self.activate() here to avoid race/loop
			}
		});
	}

	function checkTabs() {
		if (!options.enableBackground) {
			chrome.tabs.query({}, tabs => {
				if (tabs.length == 0) {
					if (browserClosed) return;
					chrome.storage.local.set({ paused: true });
					notifyListeners("pause", [], callbacks, options);
					browserClosed = true;
				} else if (browserClosed) {
					self.activate();
					browserClosed = false;
				}
			});
		}
	}
}

// Possible events include:
// volume, kkStart, hourMusic, gameChange, weatherChange, pause, tabAudio, musicFailed
export function notifyListeners(event, args, callbacks, options) {
	console.log('[StateManager.js] notifyListeners called:', event, args, callbacks, options);
	if (!options || !callbacks) return; // Defensive: don't proceed if missing
	if (!options.paused || event === "pause" || event === "volume") {
		var callbackArr = callbacks[event] || [];
		for (var i = 0; i < callbackArr.length; i++) {
			//callbackArr[i].apply(window, args);
		}
		// Always send to both offscreen-doc and service-worker in service worker context
		const offscreenEvents = [
			'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'volume', 'tabAudio'
		];
		const isServiceWorker = (typeof importScripts === 'function');
		if (isServiceWorker && offscreenEvents.includes(event)) {
			chrome.runtime.sendMessage({
				"type": event,
				"target": "offscreen-doc",
				"data": args
			});
			// Directly update badge in service worker
			if (typeof globalThis.badgeManager !== 'undefined' && globalThis.badgeManager && typeof globalThis.badgeManager.handleEvent === 'function') {
				globalThis.badgeManager.handleEvent(event, args);
			}
		} else {
			console.log('[StateManager.js] Sending message to service-worker:', event, args);
			chrome.runtime.sendMessage({
				"type": event,
				"target": "service-worker",
				"data": args
			});
		}
		printDebug("Notified listeners of " + event + " with args: " + args);
	}
}