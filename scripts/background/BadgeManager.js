// Static handler for direct badge updates in service worker
export function handleBadgeEvent(type, args) {
	// This function mirrors the logic in the onMessage handler
	// 'this' context is not used, so we can call setIcon/setBadgeText as statics
	// Use chrome.action for Manifest V3
	const actionApi = (typeof chrome !== 'undefined' && chrome.action) ? chrome.action : undefined;
	function setBadgeText(text, color = [57, 230, 0, 255]) {
		if (!actionApi) {
			console.error('[BadgeManager] chrome.action is not available in this context. Cannot set badge text.');
			return;
		}
		actionApi.setBadgeText({ text });
		actionApi.setBadgeBackgroundColor({ color });
		console.log('[BadgeManager] setBadgeText', text);
	}
	function setIcon(icon) {
		if (!actionApi) {
			console.error('[BadgeManager] chrome.action is not available in this context. Cannot set icon.');
			return;
		}
		let path;
		if (icon === 'kk') {
			path = {
				128: `img/icons/kk/128.png`,
				64: `img/icons/kk/64.png`,
				32: `img/icons/kk/32.png`,
			};
		} else if (icon === 'paused') {
			path = {
				128: `img/icons/status/paused/128.png`,
				64: `img/icons/status/paused/64.png`,
				32: `img/icons/status/paused/32.png`,
			};
		} else if (["sunny", "raining", "snowing"].includes(icon)) {
			path = {
				128: `img/icons/status/${icon}/128.png`,
				64: `img/icons/status/${icon}/64.png`,
				32: `img/icons/status/${icon}/32.png`,
			};
		} else {
			// fallback to sunny
			path = {
				128: `img/icons/status/sunny/128.png`,
				64: `img/icons/status/sunny/64.png`,
				32: `img/icons/status/sunny/32.png`,
			};
		}
		console.log('[BadgeManager] setIcon called with', icon, path);
		actionApi.setIcon({ path });
	}
	// Minimal state for badgeText/lastWeather
	let badgeText = '';
	let lastWeather = 'sunny';
	function safeFormatHour(hour) {
		if (typeof formatHour === 'function') return formatHour(hour);
		return String(hour).padStart(2, '0');
	}
	if (type === 'hourMusic') {
		let hour = args[0];
		let weather = args[1] || 'sunny';
		badgeText = `${safeFormatHour(hour)}`;
		setBadgeText(badgeText);
		setIcon(weather);
		lastWeather = weather;
	} else if (type === 'kkStart') {
		badgeText = "KK";
		setBadgeText(badgeText);
		setIcon('kk');
	} else if (type === 'pause') {
		let tabPause = args[0];
		if (tabPause) {
			setBadgeText("ll");
		} else setBadgeText("");
		setIcon('paused');
	} else if (type === 'unpause') {
		setBadgeText(badgeText);
		setIcon(lastWeather);
	} else if (type === 'musicFailed') {
		setBadgeText("x", [230, 0, 0, 255]);
	} else if (type === 'gameChange' || type === 'weatherChange') {
		let hour = args[0];
		let weather = args[1];
		setIcon(weather);
		lastWeather = weather;
		setBadgeText(badgeText);
	} else if (type === 'tabAudio') {
		if (args[0]) {
			setBadgeText(badgeText);
			setIcon(lastWeather);
		} else {
			setBadgeText("ll");
			setIcon('paused');
		}
	}
}
// Handles the badge on the icon

'use strict';

export function BadgeManager(addEventListener, isEnabledStart) {
	function safeFormatHour(hour) {
		if (typeof formatHour === 'function') return formatHour(hour);
		// Convert to 12-hour format for badge display
		if (hour === 0) return '12am';
		if (hour === 12) return '12pm';
		if (hour < 12) return hour + 'am';
		return (hour - 12) + 'pm';
	}
	let isEnabled = isEnabledStart;
	let isTabAudible = false;
	let badgeText;
	let badgeIcon;
	let lastWeather = 'sunny'; // Default to sunny
	let lastIconType = 'weather'; // Track if we were showing 'weather' or 'kk'

	this.updateEnabled = (enabled) => {
		isEnabled = enabled;
		if (enabled) updateBadgeText();
		else updateBadgeText(true);
	}

	// Use chrome.action for Manifest V3
	const actionApi = chrome.action || chrome.browserAction;
	actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });

	function updateBadgeText(reset = false) {
		if (isTabAudible) return;
		let text = badgeText || "";
		if (reset) text = "";
		setBadgeText(text);
	}

	function setBadgeText(text, color = [57, 230, 0, 255]) {
		actionApi.setBadgeText({ text });
		actionApi.setBadgeBackgroundColor({ color });
		console.log('[BadgeManager] setBadgeText', text);
	}

	function setIcon(icon) {
		if (icon != 'paused' && icon != 'kk') {
			badgeIcon = icon;
			lastWeather = icon;
		}
		let path;
		if (!icon) icon = 'sunny';
		if (icon === 'kk') {
			path = {
				128: `img/icons/kk/128.png`,
				64: `img/icons/kk/64.png`,
				32: `img/icons/kk/32.png`,
			};
		} else if (icon === 'paused') {
			path = {
				128: `img/icons/status/paused/128.png`,
				64: `img/icons/status/paused/64.png`,
				32: `img/icons/status/paused/32.png`,
			};
		} else if (["sunny", "raining", "snowing"].includes(icon)) {
			path = {
				128: `img/icons/status/${icon}/128.png`,
				64: `img/icons/status/${icon}/64.png`,
				32: `img/icons/status/${icon}/32.png`,
			};
		} else {
			// fallback to sunny
			path = {
				128: `img/icons/status/sunny/128.png`,
				64: `img/icons/status/sunny/64.png`,
				32: `img/icons/status/sunny/32.png`,
			};
		}
		console.log('[BadgeManager] setIcon called with', icon, path);
		actionApi.setIcon({ path });
	}

	// Listen for tabAudio and other events
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		console.log('[BadgeManager] onMessage', message);
		if (!message || message.target !== 'service-worker') return;
		const { type, data: args } = message;
		if (type === 'hourMusic') {
			let hour = args[0];
			let weather = args[1] || 'sunny';
			let isHourlyChange = args[3]; // 4th argument indicates if this is a real hourly change
			// Don't override KK mode unless this is a real hourly time change (not a settings/pause change)
			if (lastIconType === 'kk' && !isHourlyChange) {
				lastWeather = weather; // Update weather for later use, but don't change icon/text
				console.log('[BadgeManager] hourMusic during KK mode (not hourly change) - updating weather but keeping KK icon');
				return;
			}
			// If this is a real hourly change, it means KK time ended, so we switch back to regular music
			badgeText = `${safeFormatHour(hour)}`;
			if (isEnabled) updateBadgeText();
			setIcon(weather);
			lastWeather = weather;
			lastIconType = 'weather';
		} else if (type === 'kkStart') {
			badgeText = "KK";
			console.log('[BadgeManager] kkStart event');
			if (isEnabled) updateBadgeText();
			setIcon('kk');
			lastIconType = 'kk';
		} else if (type === 'pause') {
			let tabPause = args[0];
			if (tabPause) {
				isTabAudible = true;
				setBadgeText("ll");
			} else setBadgeText("");
			setIcon('paused');
			console.log('[BadgeManager] pause event, set paused icon');
		} else if (type === 'unpause') {
			isTabAudible = false;
			if (isEnabled) setBadgeText(badgeText);
			// Restore the appropriate icon based on what was showing before pause
			if (lastIconType === 'kk') {
				setIcon('kk');
				console.log('[BadgeManager] unpause event, restored KK icon');
			} else {
				setIcon(lastWeather);
				console.log('[BadgeManager] unpause event, set weather icon:', lastWeather);
			}
		} else if (type === 'musicFailed') {
			setBadgeText("x", [230, 0, 0, 255]);
		} else if (type === 'gameChange' || type === 'weatherChange') {
			let hour = args[0];
			let weather = args[1] || 'sunny';
			// Don't override KK mode - only update weather info but keep KK icon
			if (lastIconType === 'kk') {
				lastWeather = weather; // Update weather for later use, but don't change icon
				console.log('[BadgeManager] gameChange/weatherChange during KK mode - updating weather but keeping KK icon');
				return;
			}
			setIcon(weather);
			lastWeather = weather;
			if (isEnabled) updateBadgeText();
			console.log('[BadgeManager] change event, set icon:', weather);
		} else if (type === 'tabAudio') {
			// Unpause icon if audible, pause if not
			if (args[0]) {
				isTabAudible = false;
				if (isEnabled) setBadgeText(badgeText);
				if (lastIconType === 'kk') {
					setIcon('kk');
					console.log('[BadgeManager] tabAudio unpause event, restored KK icon');
				} else {
					setIcon(lastWeather);
					console.log('[BadgeManager] tabAudio unpause event, set weather icon:', lastWeather);
				}
			} else {
				isTabAudible = true;
				setBadgeText("ll");
				setIcon('paused');
				console.log('[BadgeManager] tabAudio pause event, set paused icon');
			}
		}
	});

	// Add handleEvent method that can be called directly
	this.handleEvent = function(type, args) {
		console.log('[BadgeManager] handleEvent called:', type, args);
		
		if (type === 'hourMusic') {
			let hour = args[0];
			let weather = args[1] || 'sunny';
			let isHourlyChange = args[3]; // 4th argument indicates if this is a real hourly change
			// Don't override KK mode unless this is a real hourly time change (not a settings/pause change)
			if (lastIconType === 'kk' && !isHourlyChange) {
				lastWeather = weather; // Update weather for later use, but don't change icon/text
				console.log('[BadgeManager] hourMusic during KK mode (not hourly change) - updating weather but keeping KK icon');
				return;
			}
			// If this is a real hourly change, it means KK time ended, so we switch back to regular music
			badgeText = `${safeFormatHour(hour)}`;
			if (isEnabled) updateBadgeText();
			// Use chrome.runtime.getURL for proper extension URLs in service worker
			console.log('[BadgeManager] Setting weather icon:', weather);
			let iconPaths;
			if (weather === 'sunny') {
				iconPaths = {
					128: chrome.runtime.getURL("img/icons/status/sunny/128.png"),
					64: chrome.runtime.getURL("img/icons/status/sunny/64.png"),
					32: chrome.runtime.getURL("img/icons/status/sunny/32.png")
				};
			} else if (weather === 'raining') {
				iconPaths = {
					128: chrome.runtime.getURL("img/icons/status/raining/128.png"),
					64: chrome.runtime.getURL("img/icons/status/raining/64.png"),
					32: chrome.runtime.getURL("img/icons/status/raining/32.png")
				};
			} else if (weather === 'snowing') {
				iconPaths = {
					128: chrome.runtime.getURL("img/icons/status/snowing/128.png"),
					64: chrome.runtime.getURL("img/icons/status/snowing/64.png"),
					32: chrome.runtime.getURL("img/icons/status/snowing/32.png")
				};
			} else {
				// Fallback to sunny
				iconPaths = {
					128: chrome.runtime.getURL("img/icons/status/sunny/128.png"),
					64: chrome.runtime.getURL("img/icons/status/sunny/64.png"),
					32: chrome.runtime.getURL("img/icons/status/sunny/32.png")
				};
			}
			
			actionApi.setIcon({ path: iconPaths }).then(() => {
				console.log('[BadgeManager] Weather icon set successfully to:', weather);
			}).catch((error) => {
				console.error('[BadgeManager] Weather icon setting failed:', error);
			});
			lastWeather = weather;
			lastIconType = 'weather';
		} else if (type === 'kkStart') {
			badgeText = "KK";
			console.log('[BadgeManager] kkStart event');
			if (isEnabled) updateBadgeText();
			actionApi.setIcon({
				path: {
					128: chrome.runtime.getURL("img/icons/kk/128.png"),
					64: chrome.runtime.getURL("img/icons/kk/64.png"),
					32: chrome.runtime.getURL("img/icons/kk/32.png")
				}
			}).then(() => {
				console.log('[BadgeManager] KK icon set successfully');
			}).catch((error) => {
				console.error('[BadgeManager] KK icon setting failed:', error);
			});
			lastIconType = 'kk';
		} else if (type === 'pause') {
			// For pause events, always set "ll" regardless of args
			// The pause event itself indicates we should show pause text
			actionApi.setBadgeText({ text: "ll" });
			actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });
			console.log('[BadgeManager] setBadgeText ll (pause)');
			// Set paused icon with proper URL
			actionApi.setIcon({
				path: {
					128: chrome.runtime.getURL("img/icons/status/paused/128.png"),
					64: chrome.runtime.getURL("img/icons/status/paused/64.png"),
					32: chrome.runtime.getURL("img/icons/status/paused/32.png")
				}
			}).then(() => {
				console.log('[BadgeManager] Paused icon set successfully');
			}).catch((error) => {
				console.error('[BadgeManager] Paused icon setting failed:', error);
			});
		} else if (type === 'unpause') {
			isTabAudible = false;
			if (isEnabled) setBadgeText(badgeText);
			// Restore the appropriate icon based on what was showing before pause
			if (lastIconType === 'kk') {
				actionApi.setIcon({
					path: {
						128: chrome.runtime.getURL("img/icons/kk/128.png"),
						64: chrome.runtime.getURL("img/icons/kk/64.png"),
						32: chrome.runtime.getURL("img/icons/kk/32.png")
					}
				}).then(() => {
					console.log('[BadgeManager] KK icon restored successfully');
				}).catch((error) => {
					console.error('[BadgeManager] KK icon restore failed:', error);
				});
			} else {
				// Restore weather icon using proper URL
				let iconPaths = {
					128: chrome.runtime.getURL(`img/icons/status/${lastWeather}/128.png`),
					64: chrome.runtime.getURL(`img/icons/status/${lastWeather}/64.png`),
					32: chrome.runtime.getURL(`img/icons/status/${lastWeather}/32.png`)
				};
				actionApi.setIcon({ path: iconPaths }).then(() => {
					console.log('[BadgeManager] Weather icon restored to:', lastWeather);
				}).catch((error) => {
					console.error('[BadgeManager] Weather icon restore failed:', error);
				});
			}
		} else if (type === 'musicFailed') {
			setBadgeText("x", [230, 0, 0, 255]);
		} else if (type === 'gameChange' || type === 'weatherChange') {
			let hour = args[0];
			let weather = args[1] || 'sunny';
			// Don't override KK mode - only update weather info but keep KK icon
			if (lastIconType === 'kk') {
				lastWeather = weather; // Update weather for later use, but don't change icon
				console.log('[BadgeManager] gameChange/weatherChange during KK mode - updating weather but keeping KK icon');
				return;
			}
			setIcon(weather);
			lastWeather = weather;
			// Don't update badge text if we're paused (isTabAudible = true)
			if (isEnabled && !isTabAudible) updateBadgeText();
			console.log('[BadgeManager] change event, set icon:', weather);
		} else if (type === 'tabAudio') {
			if (args[0]) {
				isTabAudible = false;
				if (isEnabled) setBadgeText(badgeText);
				if (lastIconType === 'kk') {
					actionApi.setIcon({
						path: {
							128: chrome.runtime.getURL("img/icons/kk/128.png"),
							64: chrome.runtime.getURL("img/icons/kk/64.png"),
							32: chrome.runtime.getURL("img/icons/kk/32.png")
						}
					}).then(() => {
						console.log('[BadgeManager] tabAudio unpause event, restored KK icon successfully');
					}).catch((error) => {
						console.error('[BadgeManager] tabAudio KK icon restore failed:', error);
					});
				} else {
					// Restore weather icon using proper URL
					let iconPaths = {
						128: chrome.runtime.getURL(`img/icons/status/${lastWeather}/128.png`),
						64: chrome.runtime.getURL(`img/icons/status/${lastWeather}/64.png`),
						32: chrome.runtime.getURL(`img/icons/status/${lastWeather}/32.png`)
					};
					actionApi.setIcon({ path: iconPaths }).then(() => {
						console.log('[BadgeManager] tabAudio unpause event, set weather icon:', lastWeather);
					}).catch((error) => {
						console.error('[BadgeManager] tabAudio weather icon restore failed:', error);
					});
				}
			} else {
				isTabAudible = true;
				// Use actionApi directly to bypass updateBadgeText logic
				actionApi.setBadgeText({ text: "ll" });
				actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });
				actionApi.setIcon({
					path: {
						128: chrome.runtime.getURL("img/icons/status/paused/128.png"),
						64: chrome.runtime.getURL("img/icons/status/paused/64.png"),
						32: chrome.runtime.getURL("img/icons/status/paused/32.png")
					}
				}).then(() => {
					console.log('[BadgeManager] tabAudio pause event, set paused icon with ll text successfully');
				}).catch((error) => {
					console.error('[BadgeManager] tabAudio paused icon failed:', error);
				});
			}
		}
	};
}