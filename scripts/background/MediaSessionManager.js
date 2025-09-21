// Handles MediaSession (audio metadata) management

'use strict';

import { getLocalUrl, checkMediaSessionSupport, printDebug } from "./Utility";

export function MediaSessionManager() {

	let gameNames = {
		'animal-crossing': 'Animal Crossing',
		'wild-world': 'Animal Crossing: Wild World',
		'new-leaf': 'Animal Crossing: New Leaf',
		'new-horizons': 'Animal Crossing: New Horizons'
	}

	// Updates the mediasession metadata (for hourly music)
	this.updateMetadata = async function (game, hour, weather) {
    checkMediaSessionSupport(async () => {
        let artwork = await toDataURL(game);
        navigator.mediaSession.metadata = new MediaMetadata({
            title: `${formatHour(hour)} (${capitalize(weather)})`,
            artist: gameNames[game],
            album: 'Animal Crossing Music',
            artwork: [
                { src: artwork, sizes: '512x512', type: 'image/png' }
            ]
        });
        printDebug('Updated MediaSession (hourly): ', navigator.mediaSession.metadata);
    });
}

	// Updates the mediasession metadata (for kk)
	this.updateMetadataKK = async function (title, fileName) {
    checkMediaSessionSupport(async () => {
        let metadata = new MediaMetadata({
            title,
            artist: 'K.K. Slider',
            album: 'Animal Crossing Music'
        });
        let artworkSrc = await toDataURL(fileName, true);
        metadata.artwork = [
            { src: artworkSrc, sizes: '512x512', type: 'image/png' }
        ];
        navigator.mediaSession.metadata = metadata;
        printDebug('Updated MediaSession (kk): ', navigator.mediaSession.metadata);
    });
}

	// Gets a blob URL from a local file.
	function toDataURL(name, kk = false) {
		return new Promise(resolve => {
			let imagePath;
			if (kk) {
				// For KK music, always use kk.png regardless of song name
				imagePath = `../img/cover/kk.png`;
			} else {
				// For regular hourly music, use the game name
				imagePath = `../img/cover/${name}.png`;
			}
			printDebug(`Trying to retrieve art from local storage: "${imagePath}"`)

			return fetch(getLocalUrl(imagePath))
			.then(async (response) => response.blob())
			.then(async (blob) => {
				printDebug('Successfully created blob url from local image')
				return URL.createObjectURL(blob);
			})
			.catch(() => fallback)

			// Fallback function
			async function fallback() {
				printDebug('Could not create blob url from local image')
				
				// Prevent potential infinite loops.
				if (name == 'kk') resolve('');

				if (kk) {
					let kkArtUrl = `https://acmusicext.com/static/kk/art/${name}.png`
					printDebug(`Using fallback remote url: "${kkArtUrl}"`)
					return kkArtUrl;
				}
				else {
					let defaultKkArtName = 'kk'
					printDebug(`Try using default kk art: ${defaultKkArtName}`)
					return await toDataURL('defaultKkArtName');
				} 
			}
		});
	}
}
