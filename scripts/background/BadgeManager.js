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
		if (!icon) icon = 'sunny';
		
		// Determine the base path based on icon type
		let basePath;
		if (icon === 'kk') {
			basePath = 'img/icons/kk';
		} else {
			basePath = `img/icons/status/${icon}`;
		}
		
		// Create the path object for all sizes
		const path = {
			128: `${basePath}/128.png`,
			64: `${basePath}/64.png`,
			32: `${basePath}/32.png`,
		};
		
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
			
			console.log('[BadgeManager] Setting weather icon:', weather);
			actionApi.setIcon({ path: getIconPaths(weather) }).then(() => {
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
			
			actionApi.setIcon({ path: getIconPaths('kk') }).then(() => {
				console.log('[BadgeManager] KK icon set successfully');
			}).catch((error) => {
				console.error('[BadgeManager] KK icon setting failed:', error);
			});
			lastIconType = 'kk';
		} else if (type === 'pause') {
			// For pause events, always set "ll" regardless of args
			actionApi.setBadgeText({ text: "ll" });
			actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });
			console.log('[BadgeManager] setBadgeText ll (pause)');
			
			actionApi.setIcon({ path: getIconPaths('paused') }).then(() => {
				console.log('[BadgeManager] Paused icon set successfully');
			}).catch((error) => {
				console.error('[BadgeManager] Paused icon setting failed:', error);
			});
		} else if (type === 'unpause') {
			isTabAudible = false;
			if (isEnabled) setBadgeText(badgeText);
			
			// Restore the appropriate icon based on what was showing before pause
			const iconToRestore = lastIconType === 'kk' ? 'kk' : lastWeather;
			actionApi.setIcon({ path: getIconPaths(iconToRestore) }).then(() => {
				console.log(`[BadgeManager] ${lastIconType === 'kk' ? 'KK' : 'Weather'} icon restored successfully to:`, iconToRestore);
			}).catch((error) => {
				console.error('[BadgeManager] Icon restore failed:', error);
			});
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
				
				const iconToRestore = lastIconType === 'kk' ? 'kk' : lastWeather;
				actionApi.setIcon({ path: getIconPaths(iconToRestore) }).then(() => {
					console.log(`[BadgeManager] tabAudio unpause event, restored ${lastIconType === 'kk' ? 'KK' : 'weather'} icon:`, iconToRestore);
				}).catch((error) => {
					console.error('[BadgeManager] tabAudio icon restore failed:', error);
				});
			} else {
				isTabAudible = true;
				// Use actionApi directly to bypass updateBadgeText logic
				actionApi.setBadgeText({ text: "ll" });
				actionApi.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });
				
				actionApi.setIcon({ path: getIconPaths('paused') }).then(() => {
					console.log('[BadgeManager] tabAudio pause event, set paused icon with ll text successfully');
				}).catch((error) => {
					console.error('[BadgeManager] tabAudio paused icon failed:', error);
				});
			}
		}
	};
}