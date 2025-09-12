// Handles fetching the new weather and notifying a callback when it changes

'use strict';

export function WeatherManager(zip, country) {
	let self = this;

	let timeout;
	let callback;

	let weather;

	this.registerChangeCallback = function (cb) {
		callback = cb;
	};

	this.setZip = function (newZip) {
		zip = newZip;
	};

	this.setCountry = function (newCountry) {
		country = newCountry;
		restartCheckLoop();
	};

	this.getWeather = function () {
		return weather;
	};

	// Checks the weather, and restarts the loop
	function restartCheckLoop() {
		if (timeout) clearTimeout(timeout);
		timeout = null;
		weatherCheckLoop();
	}

	// Checks the weather every 10 minutes, calls callback if it's changed
	let weatherCheckLoop = function () {
		let url = `https://acmusicext.com/api/weather-v1/${country}/${zip}`
		fetch(url)
		.then((response) => {
			if (response.status == 200 || response.status == 304) {
				return response.json();
			} else throw Error;
		})
		.then((response) => {
			if (response.weather !== weather) {
				let oldWeather = self.getWeather();
				weather = response.weather;
				if (weather !== oldWeather && typeof callback === 'function') callback();
			}
		})
		.catch(() => {
			if (!weather) {
				weather = "Clear";
				callback();
			}
		})
		timeout = setTimeout(weatherCheckLoop, 600000);
	};

	weatherCheckLoop();
}
