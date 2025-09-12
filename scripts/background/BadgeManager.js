// Handles the badge on the icon

'use strict';

export function BadgeManager(addEventListener, isEnabledStart) {
	let isEnabled = isEnabledStart;
	let isTabAudible = false;
	let badgeText;
	let badgeIcon;

	this.updateEnabled = (enabled) => {
		printDebug("BadgeText has been set to", enabled);

		isEnabled = enabled;

		if (enabled) updateBadgeText();
		else updateBadgeText(true);
	}

	chrome.browserAction.setBadgeBackgroundColor({ color: [57, 230, 0, 255] });

	function updateBadgeText(reset = false) {
		if (isTabAudible) return;

		printDebug("Updating BadgeText to", badgeText);

		let text = badgeText || "";
		if (reset) text = "";

		setBadgeText(text);
	}

	function setBadgeText(text, color = [57, 230, 0, 255]) {
		chrome.browserAction.setBadgeText({ text });
		chrome.browserAction.setBadgeBackgroundColor({ color });
	}

	function setIcon(icon) {
		if (icon != 'paused') badgeIcon = icon;

		let path = {
			128: `img/icons/status/${icon}/128.png`,
			64: `img/icons/status/${icon}/64.png`,
			32: `img/icons/status/${icon}/32.png`,
		};

		if (icon == 'kk') {
			path = {
				128: `img/icons/kk/128.png`,
				64: `img/icons/kk/64.png`,
				32: `img/icons/kk/32.png`,
			};
		}
		
		chrome.browserAction.setIcon({ path });
	}
}

chrome.runtime.onMessage.addListener((type, target, args) => {
	console.log(type, target, args)
	if (target !== 'service-worker') return;

	if (type == 'hourMusic') {
		let hour = args[0]
		let weather = args[1]
		badgeText = `${formatHour(hour)}`;
		if (!isTabAudible) {
			if (isEnabled) updateBadgeText();
			setIcon(weather);
		}
	}

	if (type == 'kkStart') {
		badgeText = "KK";
		if (isEnabled) updateBadgeText();
		setIcon('kk');
	}

	if (type == 'pause') {
		let tabPause = args[0]
		if (tabPause) {
			isTabAudible = true;
			setBadgeText("ll");
		} else setBadgeText("");
		setIcon('paused');
	}

	if (type == 'unpause') {
		isTabAudible = false;
		if (isEnabled) setBadgeText(badgeText);
		if (badgeIcon) setIcon(badgeIcon);
	}

	if (type == 'musicFailed') {
		setBadgeText("x", [230, 0, 0, 255]);
	}

	if (type == 'gameChange' || type == 'weatherChange') {
		let hour = args[0]
		let weather = args[1]
		setIcon(weather)
	}
})