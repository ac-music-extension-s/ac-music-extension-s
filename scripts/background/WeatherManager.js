// temp file to handle the WeatherAPI calls.

'use strict';

function WeatherManager(key, loc) {
    let self = this;
    console.log({key: key, loc: loc});

    let timeout;
    let callback;

    let weather;

    const sun = [1000, 1003, 1006, 1009, 1030, 1135, 1147];
    const rain = [1063, 1066, 1069, 1072, 1087, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246, 1249, 1252, 1273, 1276];
    const snow = [1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255, 1258, 1261, 1264, 1279, 1282];
    

    this.registerChangeCallback = function(cb) {
        callback = cb;
    };

    this.getWeather = function () {
        console.log(weather);
        return weather;
    };

    this.setKey = function(newKey) {
        key = newKey;
        console.log("New key: " + key);
    };

    this.setLocation = function(newLocation) {
        loc = newLocation;
        console.log("New location: " + loc);
    };

    // Checks the weather, and restarts the loop.
    function restartCheckLoop() {
        if (timeout) clearTimeout(timeout);
        timeout = null;
        weatherCheckLoop();
    }

    // Checks the weather every 10 minutes, calls callback if it's changed.
    let weatherCheckLoop = function () {
        let url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=${loc}`
        let request = new XMLHttpRequest();
        let wxCode;

        request.onload = function () {
            if (request.status == 200 || request.status == 304) {
                let response = JSON.parse(request.responseText);
                console.log(response);
                if (response.current) {
                    let oldWeather = self.getWeather();
                    wxCode = response.current.condition.code;
                    weather = sun.includes(wxCode) ? "Clear" : rain.includes(wxCode) ? "Rain" : snow.includes(wxCode) ? "Snow" : "Clear"; // using "Clear" as a fallback
                    if (oldWeather !== weather && typeof callback === 'function') callback();
                } else {
                    if (!weather) weather = "Clear";
                    console.warn("API Response did not include current weather conditions, defaulting to Clear.", response);
                    alert("API Response did not include the current conditions for the specified location, please check your dev console for more details.");
                }
                
            } else err();
        };

        request.onerror = err;

        function err() {
            if (!weather) {
                weather = "Clear";
                callback();
            }
        }

        request.open("GET", url, true);
        request.send();
        timeout = setTimeout(weatherCheckLoop, 600000);
    };

    weatherCheckLoop();

    if (DEBUG_FLAG) {
        window.changeWeather = function (newWeather) {
            weather = newWeather;
            callback();
        }
    }
}