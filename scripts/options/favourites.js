'use strict';

const game_options = ['no-change', 'game-random', 'animal-crossing', 'wild-world', 'new-leaf', 'new-horizons'];
const weather_options = ['no-change', 'weather-random', 'sunny', 'raining', 'snowing', 'live'];
const DEFAULT_FAVS = [
    { game: 'no-change', weather: 'no-change' }, // 00:00 - 01:00
    { game: 'no-change', weather: 'no-change' }, // 01:00 - 02:00
    { game: 'no-change', weather: 'no-change' }, // 02:00 - 03:00
    { game: 'no-change', weather: 'no-change' }, // 03:00 - 04:00
    { game: 'no-change', weather: 'no-change' }, // 04:00 - 05:00
    { game: 'no-change', weather: 'no-change' }, // 05:00 - 06:00
    { game: 'no-change', weather: 'no-change' }, // 06:00 - 07:00
    { game: 'no-change', weather: 'no-change' }, // 07:00 - 08:00
    { game: 'no-change', weather: 'no-change' }, // 08:00 - 09:00
    { game: 'no-change', weather: 'no-change' }, // 09:00 - 10:00
    { game: 'no-change', weather: 'no-change' }, // 10:00 - 11:00
    { game: 'no-change', weather: 'no-change' }, // 11:00 - 12:00
    { game: 'no-change', weather: 'no-change' }, // 12:00 - 13:00
    { game: 'no-change', weather: 'no-change' }, // 13:00 - 14:00
    { game: 'no-change', weather: 'no-change' }, // 14:00 - 15:00
    { game: 'no-change', weather: 'no-change' }, // 15:00 - 16:00
    { game: 'no-change', weather: 'no-change' }, // 16:00 - 17:00
    { game: 'no-change', weather: 'no-change' }, // 17:00 - 18:00
    { game: 'no-change', weather: 'no-change' }, // 18:00 - 19:00
    { game: 'no-change', weather: 'no-change' }, // 19:00 - 20:00
    { game: 'no-change', weather: 'no-change' }, // 20:00 - 21:00
    { game: 'no-change', weather: 'no-change' }, // 21:00 - 22:00
    { game: 'no-change', weather: 'no-change' }, // 22:00 - 23:00
    { game: 'no-change', weather: 'no-change' }  // 23:00 - 00:00
];
let UserFavs;

function restoreFavourites() {
    chrome.storage.sync.get({
        favs: DEFAULT_FAVS
    }, items => {
        UserFavs = items.favs;
    });
}

function saveFavourites() {
    chrome.storage.sync.set({
        favs: UserFavs ? UserFavs : DEFAULT_FAVS
    });
}

restoreFavourites();