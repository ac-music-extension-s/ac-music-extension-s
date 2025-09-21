// Handles the badge on the icon

'use strict';

import { printDebug } from './Utility.js';

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
		printDebug('[BadgeManager] setBadgeText', text);
	}

	function setIcon(icon) {
		if (icon != 'paused' && icon != 'kk') {
			badgeIcon = icon;
			lastWeather = icon;
		}
		if (!icon) icon = 'sunny';
		
		// Use the same getIconPaths helper to ensure consistent URL handling
		const path = getIconPaths(icon);
		
		printDebug('[BadgeManager] setIcon called with', icon, path);
		actionApi.setIcon({ path });
	}

	// Shared event handling logic used by both message listener and direct handleEvent calls
	function processEvent(type, args, useServiceWorkerIconPaths = false) {
		if (type === 'hourMusic') {
			let hour = args[0];
			let weather = args[1] || 'sunny';
			
			if (lastIconType === 'kk') {
				printDebug('[BadgeManager] Transitioning from KK mode back to hourly music');
			}
			
			badgeText = `${safeFormatHour(hour)}`;
			if (isEnabled) updateBadgeText();
			
			if (useServiceWorkerIconPaths) {
				printDebug('[BadgeManager] Setting weather icon:', weather);
				actionApi.setIcon({ path: getIconPaths(weather) }).then(() => {
					printDebug('[BadgeManager] Weather icon set successfully to:', weather);
				}).catch((error) => {
					console.error('[BadgeManager] Weather icon setting failed:', error);
				});
			} else {
				setIcon(weather);
			}
			lastWeather = weather;
			lastIconType = 'weather';
		} else if (type === 'kkStart') {
			badgeText = "KK";
			printDebug('[BadgeManager] kkStart event');
			if (isEnabled) updateBadgeText();
			
			if (useServiceWorkerIconPaths) {
				actionApi.setIcon({ path: getIconPaths('kk') }).then(() => {
					printDebug('[BadgeManager] KK icon set successfully');
				}).catch((error) => {
					console.error('[BadgeManager] KK icon setting failed:', error);
				});
			} else {
				setIcon('kk');
			}
			lastIconType = 'kk';
		} else if (type === 'pause') {
			if (useServiceWorkerIconPaths) {
				actionApi.setBadgeText({ text: "ll" });
				actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });
				printDebug('[BadgeManager] setBadgeText ll (pause)');
				actionApi.setIcon({ path: getIconPaths('paused') }).then(() => {
					printDebug('[BadgeManager] Paused icon set successfully');
				}).catch((error) => {
					console.error('[BadgeManager] Paused icon setting failed:', error);
				});
			} else {
				let tabPause = args[0];
				if (tabPause) {
					isTabAudible = true;
					setBadgeText("ll");
				} else setBadgeText("");
				setIcon('paused');
				printDebug('[BadgeManager] pause event, set paused icon');
			}
		} else if (type === 'unpause') {
			if (lastIconType === "kk") {
				badgeText = "KK";
			} else {
				badgeText = `${safeFormatHour(new Date().getHours())}`;
			}
			isTabAudible = false;
			if (isEnabled) setBadgeText(badgeText);
			
			if (useServiceWorkerIconPaths) {
				const iconToRestore = lastIconType === 'kk' ? 'kk' : lastWeather;
				actionApi.setIcon({ path: getIconPaths(iconToRestore) }).then(() => {
					printDebug(`[BadgeManager] ${lastIconType === 'kk' ? 'KK' : 'Weather'} icon restored successfully to:`, iconToRestore);
				}).catch((error) => {
					console.error('[BadgeManager] Icon restore failed:', error);
				});
			} else {
				if (lastIconType === 'kk') {
					setIcon('kk');
					printDebug('[BadgeManager] unpause event, restored KK icon');
				} else {
					setIcon(lastWeather);
					printDebug('[BadgeManager] unpause event, set weather icon:', lastWeather);
				}
			}
		} else if (type === 'musicFailed') {
			setBadgeText("x", [230, 0, 0, 255]);
		} else if (type === 'gameChange' || type === 'weatherChange') {
			let hour = args[0];
			let weather = args[1] || 'sunny';
			if (lastIconType === 'kk') {
				lastWeather = weather;
				printDebug('[BadgeManager] gameChange/weatherChange during KK mode - updating weather but keeping KK icon');
				return;
			}
			
			if (useServiceWorkerIconPaths) {
				// Don't update badge text if we're paused (isTabAudible = true)
				if (isEnabled && !isTabAudible) updateBadgeText();
			} else {
				if (isEnabled) updateBadgeText();
			}
			
			if (useServiceWorkerIconPaths) {
				actionApi.setIcon({ path: getIconPaths(weather) });
			} else {
				setIcon(weather);
			}
			lastWeather = weather;
			printDebug('[BadgeManager] change event, set icon:', weather);
		} else if (type === 'tabAudio') {
			const audibleTabsDetected = args[0];
			const tabAudioSetting = args[1];
			if (audibleTabsDetected && (tabAudioSetting === 'pause' || tabaudioSetting === 'reduce')) {
				isTabAudible = true;
				if (useServiceWorkerIconPaths) {
					actionApi.setBadgeText({ text: "ll" });
					actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });
					actionApi.setIcon({ path: getIconPaths('paused') }).then(() => {
						printDebug('[BadgeManager] tabAudio pause event (audible tabs detected), set paused icon with ll text successfully');
					}).catch((error) => {
						console.error('[BadgeManager] tabAudio paused icon failed:', error);
					});
				} else {
					setBadgeText("ll");
					setIcon('paused');
					printDebug('[BadgeManager] tabAudio pause event (audible tabs detected), set paused icon');
				}
			} else {
				isTabAudible = false;
				if (lastIconType === "kk") {
					badgeText = "KK";
				} else {
					badgeText = `${safeFormatHour(new Date().getHours())}`;
				}
				if (isEnabled) setBadgeText(badgeText);
				
				if (useServiceWorkerIconPaths) {
					const iconToRestore = lastIconType === 'kk' ? 'kk' : lastWeather;
					actionApi.setIcon({ path: getIconPaths(iconToRestore) }).then(() => {
						printDebug(`[BadgeManager] tabAudio unpause event (no audible tabs), restored ${lastIconType === 'kk' ? 'KK' : 'weather'} icon:`, iconToRestore);
					}).catch((error) => {
						console.error('[BadgeManager] tabAudio icon restore failed:', error);
					});
				} else {
					if (lastIconType === 'kk') {
						setIcon('kk');
						printDebug('[BadgeManager] tabAudio unpause event (no audible tabs), restored KK icon');
					} else {
						setIcon(lastWeather);
						printDebug('[BadgeManager] tabAudio unpause event (no audible tabs), set weather icon:', lastWeather);
					}
				}
			}
		}
	}

	// Listen for tabAudio and other events - use shared logic
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		printDebug('[BadgeManager] onMessage', message);
		if (!message || message.target !== 'service-worker') return;
		const { type, data: args } = message;
		
		// Use shared processing logic with local setIcon function
		processEvent(type, args, false);
	});

	// Helper function to generate icon paths with proper URLs for service worker context
	function getIconPaths(icon) {
		if (!icon) icon = 'sunny';
		
		let basePath;
		if (icon === 'kk') {
			basePath = 'img/icons/kk';
		} else {
			basePath = `img/icons/status/${icon}`;
		}
		
		return {
			128: chrome.runtime.getURL(`${basePath}/128.png`),
			64: chrome.runtime.getURL(`${basePath}/64.png`),
			32: chrome.runtime.getURL(`${basePath}/32.png`)
		};
	}

	// Add handleEvent method that can be called directly (for service worker context)
	this.handleEvent = function(type, args) {
		printDebug('[BadgeManager] handleEvent called:', type, args);
		processEvent(type, args, true);
	};
}