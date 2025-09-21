(function () {
  'use strict';

  var availablePitches    = ['zZz', '-', 'G1', 'A1', 'B1', 'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', '?'];

    
  /**
   * @function createSampler
   * @desc  Creates & returns instrument (playNote method) used to play each note in the town tune, when it's played at the hour
   * @param {*} audioContext 
   * @returns {method} playNote
   */
  var createSampler = function(audioContext) {
    var bellBuffer;
    var startPoints = [null, null];
    var chimeLength = 3.8;

    var pitchToStartPoint = function(pitch) {
      var index = availablePitches.indexOf(pitch);
      if (index == -1) return null;

      var startPoint = startPoints[index];
      if (!startPoint) return null;

      return startPoint;
    };

    var loadBells = function() {
      fetch(chrome.runtime.getURL('../sound/bells.ogg'))
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        audioContext.decodeAudioData(buffer, function(buffer) {
          bellBuffer = buffer;
        });
      });
    };

    var initStartPoints = function() {
      for (var i = 0; i < availablePitches.length; i++) {
        startPoints.push(i * 4);
      }
    };

    var playNote = function(pitch, time, sustain, volume) {  //Sustain parameter isn't used here (unlike at createBooper.playNote)
      if (!bellBuffer) return;
      var source = audioContext.createBufferSource();
      source.buffer = bellBuffer;
      
      // If pitch is '?', randomizing pitch
      if(pitch == '?') pitch = availablePitches[ 2 + Math.floor( Math.random() * (availablePitches.length - 3) ) ];
      
      volume *= 0.5;
      // The notes sound broken & not accurate to the editor's volume when played at higher volumes, vol is therefore reduced with this multiplier.
        
      // Configuring gain
      gain = audioContext.createGain();
      gain.gain.value = volume;
      
      // Playing audio
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start(time, pitchToStartPoint(pitch), chimeLength); 
    };

    initStartPoints();
    loadBells();

    return {
      playNote: playNote
    }
  };



  /**
   * @function createTunePlayer
   * @desc  Creates & returns object responsible for handling the playing of entire town tunes at the hour and in the editor.
   * @param {*} audioContext 
   * @param {*} bpm 
   * @returns {object} tunePlayer 
   */
  var createTunePlayer = function(audioContext, bpm) {
    var defaultBpm = 240.0; // BPM
    var stepDuration;

    var rest = availablePitches[0];
    var sustain = availablePitches[1];

    var getStepDuration = function(instrument, bpm) {
      if(stepDuration) return stepDuration;
  	stepDuration = 1 / (bpm / 60);
  	return stepDuration;
    };

    var getSustainMultiplier = function(index, tune) {
      var current;
      var count = -1;
      do {
        count += 1;
        index += 1;
        current = tune[index];
      } while(current == sustain)
      return count;
    };
    
    var playTune = function(tune, instrument, bpm, volume) {
      var callbacks, i, pitch, time, sustainDuration;
      var stepDuration = getStepDuration(instrument, bpm);
      var eachNote = function(index, duration) {};
      if(!bpm) bpm = defaultBpm;
      
      for (i = 0; i < tune.length; i++) {
        time = stepDuration * i;
        
        //when a note is played
        (function(index) {
          setTimeout(function(){
            eachNote(index, stepDuration);
          }, time * 1000);
        })(i);
        
        pitch = tune[i];
        if(pitch == rest || pitch == sustain) continue;
        
        sustainDuration = getSustainMultiplier(i, tune) * stepDuration;
        
        // Plays a note using:
        //   At the hour:  createSampler.playNote() method 
        //   In the editor: createBooper.playNote() method
        instrument.playNote(pitch, audioContext.currentTime + time, sustainDuration, volume); 
      }

      //jQuery stlye chain callbacks
      callbacks = {
        eachNote: function(callback) {
          eachNote = callback;
          return callbacks;
        },
        done: function(callback) {
          //when the tune over
          if (callback) setTimeout(callback, (stepDuration * tune.length * 1000) + (stepDuration * 2));
          return callbacks;
        }
      };
      return callbacks;
    };

    var tunePlayer = {
      availablePitches: availablePitches,
      playTune: playTune
    };
    return tunePlayer;
  };

  // Handles playing town tunes, could potentially be either folded
  // into AudioManager, or tune_player instead of making createSampler
  // and createTunePlayer globally accessable.


  function TownTuneManager() {
  	// var defaultTune = ["C2", "E2", "C2", "G1", "F1", "G1", "B1", "D2", "C2", "zZz", "G1", "zZz", "C2", "-", "-", "zZz"];
  	var defaultTune = ["C3", "E3", "C3", "G2", "F2", "G2", "B2", "D3", "C3", "zZz", "?", "zZz", "C3", "-", "-", "zZz"];
  	var defaultTownTuneVolume = 0.75;
  	var defaultTabAudio = 'pause';
  	var defaultTabAudioReduceVolume = 80;
  	var audioContext = new AudioContext();
  	var sampler = createSampler(audioContext);
  	var tunePlayer = createTunePlayer(audioContext);
  	
  	// Play tune and call doneCB after it's done
  	this.playTune = function(tabAudioPlaying = false, doneCB) {
  		chrome.storage.sync.get({ townTune: defaultTune, tabAudio: defaultTabAudio, tabAudioReduceValue: defaultTabAudioReduceVolume }, function(items){
  			chrome.storage.local.get({ townTuneVolume: defaultTownTuneVolume }, (localItems) => {
                  // Reduce the volume when necessary
                  var volume = (localItems.townTuneVolume >= 0 && localItems.townTuneVolume !== null) ? localItems.townTuneVolume : defaultTownTuneVolume;
                  if (items.tabAudio == 'reduce' && tabAudioPlaying) volume = volume * (1 - items.tabAudioReduceValue / 100);
                  if (volume < 0) volume = 0;
                  if (volume > 1) volume = 1;

                  tunePlayer.playTune(items.townTune, sampler, 66, volume).done(doneCB);	//Original "BPM" was 100.
              });
  		});
  	};

  }

  // Globally accessible helper functions


  // Returns a hour-formatted string of a time
  function formatHour$1(time) {
    if (time == -1) {
      return '';
    }
    if (time == 0) {
      return '12am';
    }
    if (time == 12) {
      return '12pm';
    }
    if (time < 13) {
      return time + 'am';
    }
    return (time - 12) + 'pm';
  }

  function printDebug(...args) {
    console.log(...args);
  }


  // Returns a copy of this string having its first letter uppercased
  function capitalize$1(string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }

  function getLocalUrl(relativePath) {
    return chrome.runtime.getURL(relativePath)
  }

  var supportsMediaSession = (typeof(navigator.mediaSession) !== "undefined");
  function checkMediaSessionSupport(lambda) {
    if (supportsMediaSession) lambda();
  }

  // Handles MediaSession (audio metadata) management


  function MediaSessionManager() {

  	let gameNames = {
  		'animal-crossing': 'Animal Crossing',
  		'wild-world': 'Animal Crossing: Wild World',
  		'new-leaf': 'Animal Crossing: New Leaf',
  		'new-horizons': 'Animal Crossing: New Horizons'
  	};

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
  };

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
  };

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
  			printDebug(`Trying to retrieve art from local storage: "${imagePath}"`);

  			return fetch(getLocalUrl(imagePath))
  			.then(async (response) => response.blob())
  			.then(async (blob) => {
  				printDebug('Successfully created blob url from local image');
  				return URL.createObjectURL(blob);
  			})
  			.catch(() => fallback)

  			// Fallback function
  			async function fallback() {
  				printDebug('Could not create blob url from local image');
  				
  				// Prevent potential infinite loops.
  				if (name == 'kk') resolve('');

  				if (kk) {
  					let kkArtUrl = `https://acmusicext.com/static/kk/art/${name}.png`;
  					printDebug(`Using fallback remote url: "${kkArtUrl}"`);
  					return kkArtUrl;
  				}
  				else {
  					let defaultKkArtName = 'kk';
  					printDebug(`Try using default kk art: ${defaultKkArtName}`);
  					return await toDataURL('defaultKkArtName');
  				} 
  			}
  		});
  	}
  }

  // Keeps time and notifies passed in callback on each hour


  function TimeKeeper() {
  	try {
  		var self = this;
  		
  		var hourlyCallback;
  		
  		// DECLARING TIME VARIABLES
  		var date, currHour, currDay, currMonth, currDate;
  		// running updateTimeVariables created issues, because JavaScript, so initially updating these manually.
  		date = new Date();
  		currHour = date.getHours();
  		currDay = date.getDay();
  		currMonth = date.getMonth();
  		currDate = date.getDate();
  		// INITIALIZING VARIABLES
  		this.updateTimeVariables = function(){
  			date = new Date();
  			currHour = date.getHours();
  			currDay = date.getDay();
  			currMonth = date.getMonth();
  			currDate = date.getDate();
  		}; //();
  		

  		this.registerHourlyCallback = function(callback) {
  			hourlyCallback = callback;
  		};

  		this.getHour = function() {
  			return currHour;
  		};

  		this.getDay = function() {
  			return currDay;
  		};
  		
  		this.getMonth = function() {
  			return currMonth;	
  		};
  		
  		this.getDate = function() {
  			return currMonth;
  		};

  		
  		
  		
  		
  		/**
  		 * @function getEvent
  		 * @desc Returns the name of the current event, or "none" if no event is ongoing.
  		 * @returns {String} Name of found event, "none" if no event is found.
  		 **/
  		this.getEvent = function() {	//optionally use date as parameter (can then use "new Date()" or any date as parameter)
  			// DECLARE EVENT NAMES AND PARAMETERS
  			let events = [
  				//["<Event Name>", (<event parameters>)]
  				["Halloween", 	(this.getMonth() === 10 	&& this.getDate() === 31)],
  				["Christmas", 	(this.getMonth() === 12 	&& this.getDate() >= 24 && cthis.getDate() <= 25)], 
  				// christmas comes before winter, to prioritize it over winter, as getEvent() returns the first event it finds.
  				["Winter", 		(this.getMonth() >= 12 	|| this.getMonth() <= 2)],
  				["NewYearsEve",	(this.getMonth() === 12 	&& this.getDate() === 31)]
  				//["Easter", (timeKeeper.getMonth() === && )]
  			];
  			
  			// SCAN THROUGH EVENTS
  			for(let i = 0; i < events.length; i++){	
  				// CHECK IF EVENT IS TRUE, IF SO, RETURN IT'S NAME
  				if(events[i][1] === true) return events[i][0];
  			}
  			// RETURN "none" IF NO EVENT FOUND
  			return "none";
  		};
  		
  		
  		
  		function timeCheck() {
  			var newDate = new Date();
  			currDay = newDate.getDay();
  			// if we're in a new hour
  			if (newDate.getHours() != currHour) {
  				currHour = newDate.getHours();
  				if (hourlyCallback) {
  					hourlyCallback(currDay, currHour);
  				}
  			}
  		}

  		setInterval(timeCheck, 1000);
  	} catch (e) {
  		console.error(e);
  	}
  }

  /* 
  A list of all of the K.K. Songs.
  Used for reference so the extension can easily know the song name and game each song came from.
  Also used to make the songs more human-readable.
  */

  const KKSongList = [
      'AC - Aloha K.K.',
      'AC - Cafe K.K.',
      'AC - Comrade K.K.',
      'AC - DJ K.K.',
      'AC - Go K.K. Rider!',
      'AC - I Love You',
      'AC - Imperial K.K.',
      'AC - K.K. Aria',
      'AC - K.K. Ballad',
      'AC - K.K. Blues',
      'AC - K.K. Bossa',
      'AC - K.K. Calypso',
      'AC - K.K. Casbah',
      'AC - K.K. Chorale',
      'AC - K.K. Condor',
      'AC - K.K. Country',
      "AC - K.K. Cruisin'",
      'AC - K.K. D & B',
      'AC - K.K. Dirge',
      'AC - K.K. Etude',
      'AC - K.K. Faire',
      'AC - K.K. Folk',
      'AC - K.K. Fusion',
      'AC - K.K. Gumbo',
      'AC - K.K. Jazz',
      'AC - K.K. Lament',
      'AC - K.K. Love Song',
      'AC - K.K. Lullaby',
      'AC - K.K. Mambo',
      'AC - K.K. March',
      'AC - K.K. Parade',
      'AC - K.K. Ragtime',
      'AC - K.K. Reggae',
      'AC - K.K. Rock',
      'AC - K.K. Safari',
      'AC - K.K. Salsa',
      'AC - K.K. Samba',
      'AC - K.K. Ska',
      'AC - K.K. Song',
      'AC - K.K. Soul',
      'AC - K.K. Steppe',
      'AC - K.K. Swing',
      'AC - K.K. Tango',
      'AC - K.K. Technopop',
      'AC - K.K. Waltz',
      'AC - K.K. Western',
      'AC - Lucky K.K.',
      'AC - Mr. K.K.',
      'AC - Only Me',
      "AC - Rockin' K.K.",
      'AC - Senor K.K.',
      'AC - Soulful K.K.',
      "AC - Surfin' K.K.",
      'AC - The K. Funk',
      'AC - Two Days Ago',
      'CF - Agent K.K.',
      'CF - Forest Life',
      'CF - K.K. Dixie',
      'CF - K.K. House',
      'CF - K.K. Marathon',
      'CF - K.K. Metal',
      'CF - K.K. Rally',
      'CF - K.K. Rockabilly',
      'CF - K.K. Sonata',
      'CF - King K.K.',
      'CF - Marine Song 2001',
      'CF - Mountain Song',
      'CF - My Place',
      'CF - Neapolitan',
      'CF - Pondering',
      'CF - Spring Blossoms',
      'CF - Stale Cupcakes',
      'CF - Steep Hill',
      'CF - To the Edge',
      'CF - Wandering',
      'NL - Bubblegum K.K.',
      'NL - Hypno K.K.',
      'NL - K.K. Adventure',
      'NL - K.K. Bazaar',
      'NL - K.K. Birthday',
      'NL - K.K. Disco',
      'NL - K.K. Flamenco',
      'NL - K.K. Groove',
      'NL - K.K. Island',
      'NL - K.K. Jongara',
      'NL - K.K. Milonga',
      'NL - K.K. Moody',
      'NL - K.K. Oasis',
      'NL - K.K. Stroll',
      'NL - K.K. Synth',
      'NL - Space K.K.',
      'NH - Animal City',
      'NH - Drivin\'',
      'NH - Farewell',
      'NH - Welcome Horizons'
  ];

  // These are the times that a song will begin and end it's loop.
  // Stored as [game][weather][hour]
  // Once the song begins, it will play from the beginning of the song (0s) until the
  // "end" time. Once it reaches the "end" time, will then jump back to the "start" time.
  // If a loop time is not specified, it will default to looping the entire song.
  // Please try to keep the format the same to make it easier to read.
  // Note: times don't need to be converted to ints, strings work just fine.


  const loopTimes = {
  	'animal-crossing': {
  		sunny: {
  			 0: { start:   '0.000', end: '125.628' },
  			 1: { start:   '3.925', end: '133.740' },
  			 2: { start:   '0.000', end: '175.674' },
  			 3: { start:   '0.416', end: '177.770' },
  			 4: { start:   '0.000', end: '138.628' },
  			 5: { start:   '0.000', end: '186.119' },
  			 6: { start:   '0.396', end: '165.777' },
  			 7: { start:   '0.000', end: '137.524' },
  			 8: { start:   '0.000', end: '142.308' },
  			 9: { start:   '2.700', end: '130.613' },
  			10: { start:   '0.000', end: '116.657' },
  			11: { start:   '0.000', end: '142.220' },
  			12: { start:   '0.000', end: '109.480' },
  			13: { start:   '0.000', end: '144.945' },
  			14: { start:   '0.000', end: '130.274' },
  			15: { start:   '0.940', end:  '82.985' },
  			16: { start:   '0.000', end: '130.280' },
  			17: { start:  '10.460', end: '136.090' },
  			18: { start:   '0.000', end: '134.920' },
  			19: { start:   '0.000', end: '127.740' },
  			20: { start:   '0.000', end: '120.780' },
  			21: { start:   '0.000', end: '153.528' },
  			22: { start:   '1.240', end: '101.750' },
  			23: { start:   '0.000', end:  '80.386' }
  		},
  		snowing: {
  			 0: { start:   '0.000', end: '125.628' },
  			 1: { start:   '3.925', end: '133.740' },
  			 2: { start:   '0.000', end: '175.674' },
  			 3: { start:   '0.416', end: '177.770' },
  			 4: { start:   '0.000', end: '138.628' },
  			 5: { start:   '0.000', end: '186.119' },
  			 6: { start:   '0.396', end: '165.777' },
  			 7: { start:   '0.000', end: '137.524' },
  			 8: { start:   '0.000', end: '142.308' },
  			 9: { start:   '2.700', end: '130.613' },
  			10: { start:   '0.000', end: '116.657' },
  			11: { start:   '0.000', end: '142.220' },
  			12: { start:   '0.000', end: '109.480' },
  			13: { start:   '0.000', end: '144.945' },
  			14: { start:   '0.000', end: '130.274' },
  			15: { start:   '0.940', end:  '82.985' },
  			16: { start:   '0.000', end: '130.280' },
  			17: { start:  '10.460', end: '136.090' },
  			18: { start:   '0.000', end: '134.920' },
  			19: { start:   '0.000', end: '127.740' },
  			20: { start:   '0.000', end: '120.780' },
  			21: { start:   '0.000', end: '153.528' },
  			22: { start:   '1.240', end: '101.750' },
  			23: { start:   '0.000', end:  '80.386' }
  		}
  	},
  	'wild-world': {
  		sunny: {
  			 0: { start:  '10.370', end: '108.830' },
  			 1: { start:  '12.970', end: '103.780' },
  			 2: { start:   '7.800', end: '144.785' },
  			 3: { start:  '12.118', end:  '92.120' },
  			 4: { start:   '4.405', end:  '51.225' },
  			 5: { start:   '0.000', end: '147.695' },
  			 6: { start:   '0.610', end:  '78.985' },
  			 7: { start:   '4.670', end:  '84.670' },
  			 8: { start:   '0.000', end:  '53.335' },
  			 9: { start:   '0.490', end:  '68.495' },
  			10: { start:   '3.540', end:  '81.380' },
  			11: { start:   '0.620', end: '102.765' },
  			12: { start:   '0.000', end: '170.660' },
  			13: { start:   '5.615', end: '101.630' },
  			14: { start:  '13.330', end: '119.985' },
  			15: { start:   '0.000', end:  '73.132' },
  			16: { start:   '8.620', end: '100.520' },
  			17: { start:   '0.000', end:  '79.990' },
  			18: { start:   '1.850', end: '109.850' },
  			19: { start:   '1.300', end:  '91.300' },
  			20: { start:   '1.885', end: '149.620' },
  			21: { start:   '1.840', end:  '97.860' },
  			22: { start:   '0.000', end: '181.600' },
  			23: { start:   '0.000', end: '151.590' }
  		},
  		snowing: {
  			 0: { start:  '10.370', end: '108.830' },
  			 1: { start:  '12.970', end: '103.780' },
  			 2: { start:   '7.800', end: '144.785' },
  			 3: { start:  '12.118', end:  '92.120' },
  			 4: { start:   '4.405', end:  '51.225' },
  			 5: { start:   '0.000', end: '147.695' },
  			 6: { start:   '0.610', end:  '78.985' },
  			 7: { start:   '4.670', end:  '84.670' },
  			 8: { start:   '0.000', end:  '53.335' },
  			 9: { start:   '0.490', end:  '68.495' },
  			10: { start:   '3.540', end:  '81.380' },
  			11: { start:   '0.620', end: '102.765' },
  			12: { start:   '0.000', end: '170.695' },
  			13: { start:   '5.990', end: '101.997' },
  			14: { start:  '13.330', end: '119.985' },
  			15: { start:   '0.000', end:  '73.132' },
  			16: { start:   '8.620', end: '100.520' },
  			17: { start:   '0.000', end:  '79.990' },
  			18: { start:   '1.850', end: '109.850' },
  			19: { start:   '1.300', end:  '91.300' },
  			20: { start:   '1.885', end: '149.620' },
  			21: { start:   '1.840', end:  '97.860' },
  			22: { start:   '0.000', end: '181.600' },
  			23: { start:   '0.000', end: '151.590' }
  		},
  		raining: {
  			 0: { start:  '10.370', end: '108.830' },
  			 1: { start:  '12.970', end: '103.780' },
  			 2: { start:   '7.800', end: '144.775' },
  			 3: { start:  '12.118', end:  '92.120' },
  			 4: { start:   '4.405', end:  '51.225' },
  			 5: { start:   '0.000', end: '147.685' },
  			 6: { start:   '0.610', end:  '78.985' },
  			 7: { start:   '4.670', end:  '84.650' },
  			 8: { start:   '0.000', end:  '53.335' },
  			 9: { start:   '0.490', end:  '68.495' },
  			10: { start:   '3.540', end:  '81.380' },
  			11: { start:   '0.620', end: '102.765' },
  			12: { start:   '0.000', end: '170.660' },
  			13: { start:   '5.615', end: '101.630' },
  			14: { start:  '13.330', end: '119.985' },
  			15: { start:   '0.000', end:  '73.132' },
  			16: { start:   '8.620', end: '100.520' },
  			17: { start:   '0.000', end:  '79.990' },
  			18: { start:   '1.850', end: '109.850' },
  			19: { start:   '1.300', end:  '91.300' },
  			20: { start:   '1.885', end: '149.620' },
  			21: { start:   '1.840', end:  '97.860' },
  			22: { start:   '0.000', end: '181.600' },
  			23: { start:   '0.000', end: '151.590' }
  		}
  	},
  	'new-leaf': {
  		sunny: {
  			 0: { start:   '0.000', end:  '78.980' },
  			 1: { start:   '0.000', end: '114.630' },
  			 2: { start:   '0.000', end: '167.000' },
  			 3: { start:   '0.000', end:  '82.000' },
  			 4: { start:   '4.370', end: '109.080' },
  			 5: { start:   '0.000', end: '108.000' },
  			 6: { start:   '3.090', end:  '77.660' },
  			 7: { start:   '8.100', end:  '97.440' },
  			 8: { start:   '0.020', end:  '86.410' },
  			 9: { start:   '0.010', end:  '57.630' },
  			10: { start:   '2.875', end:  '82.045' },
  			11: { start:   '0.000', end:  '83.990' },
  			12: { start:   '0.790', end:  '86.510' },
  			13: { start:   '7.100', end:  '87.110' },
  			14: { start:   '8.830', end:  '93.550' },
  			15: { start:   '0.000', end:  '59.885' },
  			16: { start:   '2.690', end:  '92.670' },
  			17: { start:   '9.405', end: '142.970' },
  			18: { start:   '0.000', end:  '89.665' },
  			19: { start:   '7.075', end:  '91.780' },
  			20: { start:   '2.165', end:  '85.670' },
  			21: { start:   '3.040', end:  '99.015' },
  			22: { start:   '0.000', end:  '73.440' },
  			23: { start:   '0.000', end: '124.005' }
  		},
  		snowing: {
  			 0: { start:   '0.000', end:  '78.980' },
  			 1: { start:   '0.000', end: '114.660' },
  			 2: { start:   '0.000', end: '167.000' },
  			 3: { start:   '0.000', end:  '82.000' },
  			 4: { start:   '4.370', end: '109.080' },
  			 5: { start:   '0.000', end: '108.000' },
  			 6: { start:   '3.090', end:  '77.660' },
  			 7: { start:   '8.100', end:  '97.440' },
  			 8: { start:   '0.020', end:  '86.410' },
  			 9: { start:   '0.010', end:  '57.630' },
  			10: { start:   '7.770', end:  '86.900' },
  			11: { start:   '0.000', end:  '83.990' },
  			12: { start:   '0.790', end:  '86.510' },
  			13: { start:   '7.100', end:  '87.110' },
  			14: { start:   '0.000', end:  '80.810' },
  			15: { start:   '0.000', end:  '59.885' },
  			16: { start:   '2.690', end:  '92.670' },
  			17: { start:   '9.395', end: '142.970' },
  			18: { start:   '0.000', end:  '89.665' },
  			19: { start:   '7.075', end:  '91.780' },
  			20: { start:   '2.165', end:  '85.670' },
  			21: { start:   '8.290', end:  '93.630' },
  			22: { start:   '0.000', end:  '73.440' },
  			23: { start:   '0.000', end: '124.100' }
  		},
  		raining: {
  			 0: { start:   '0.000', end:  '78.980' },
  			 1: { start:   '0.000', end: '114.630' },
  			 2: { start:   '0.000', end: '167.000' },
  			 3: { start:   '0.000', end:  '82.000' },
  			 4: { start:   '4.370', end: '109.080' },
  			 5: { start:   '0.000', end: '108.000' },
  			 6: { start:   '3.090', end:  '77.660' },
  			 7: { start:   '4.500', end:  '93.850' },
  			 8: { start:   '0.020', end:  '86.410' },
  			 9: { start:   '0.010', end:  '57.630' },
  			10: { start:   '7.770', end:  '86.900' },
  			11: { start:   '0.000', end:  '83.990' },
  			12: { start:   '0.790', end:  '86.510' },
  			13: { start:   '7.100', end:  '87.110' },
  			14: { start:   '0.000', end:  '80.810' },
  			15: { start:   '0.000', end:  '59.885' },
  			16: { start:   '2.690', end:  '92.670' },
  			17: { start:   '9.395', end: '142.970' },
  			18: { start:   '0.000', end:  '89.665' },
  			19: { start:   '7.115', end:  '91.780' },
  			20: { start:   '2.165', end:  '85.670' },
  			21: { start:   '8.290', end:  '93.630' },
  			22: { start:   '0.000', end:  '73.440' },
  			23: { start:   '0.000', end: '124.005' }
  		}
  	},
  	'new-horizons': {
  		sunny: {
  			 0: { start:  '10.209', end:  '79.976' },
  			 1: { start:  '11.490', end:  '95.490' },
  			 2: { start:   '7.044', end: '109.397' },
  			 3: { start:  '10.417', end:  '60.943' },
  			 4: { start:  '17.152', end:  '72.010' },
  			 5: { start:  '24.000', end: '120.000' },
  			 6: { start:  '14.583', end:  '76.204' },
  			 7: { start:   '8.560', end:  '83.560' },
  			 8: { start:   '8.547', end:  '79.261' },
  			 9: { start:   '2.489', end:  '61.273' },
  			10: { start:  '12.642', end:  '81.975' },
  			11: { start:  '10.159', end:  '89.543' },
  			12: { start:   '7.861', end:  '73.079' },
  			13: { start:  '15.332', end:  '70.717' },
  			14: { start:   '8.368', end:  '92.089' },
  			15: { start:   '9.271', end:  '66.113' },
  			16: { start:  '25.654', end:  '76.180' },
  			17: { start:  '11.498', end: '110.129' },
  			18: { start:  '14.169', end:  '68.300' },
  			19: { start:  '12.978', end: '116.762' },
  			20: { start:   '7.084', end:  '61.084' },
  			21: { start:  '11.875', end:  '68.173' },
  			22: { start:   '3.503', end:  '70.174' },
  			23: { start:  '10.211', end:  '82.211' }
  		},
  		raining: {
  			 0: { start:  '10.209', end:  '79.976' },
  			 1: { start:  '11.466', end:  '95.466' },
  			 2: { start:   '7.044', end: '109.397' },
  			 3: { start:  '10.417', end:  '60.943' },
  			 4: { start:  '17.151', end:  '72.008' },
  			 5: { start:  '24.000', end: '120.000' },
  			 6: { start:  '14.583', end:  '76.205' },
  			 7: { start:   '8.560', end:  '83.560' },
  			 8: { start:   '8.547', end:  '79.261' },
  			 9: { start:   '2.489', end:  '61.273' },
  			10: { start:  '12.643', end:  '81.977' },
  			11: { start:  '10.421', end:  '89.811' },
  			12: { start:   '7.861', end:  '73.079' },
  			13: { start:  '15.332', end:  '70.716' },
  			14: { start:   '8.368', end:  '92.089' },
  			15: { start:   '9.268', end:  '66.110' },
  			16: { start:  '25.651', end:  '76.177' },
  			17: { start:  '11.498', end: '110.129' },
  			18: { start:  '14.167', end:  '68.297' },
  			19: { start:  '12.978', end: '116.762' },
  			20: { start:   '9.167', end:  '63.167' },
  			21: { start:  '14.446', end:  '70.742' },
  			22: { start:   '6.690', end:  '73.356' },
  			23: { start:  '10.208', end:  '82.208' }
  		},
  		snowing: {
  			 0: { start:  '10.209', end:  '79.976' },
  			 1: { start:  '16.002', end: '100.002' },
  			 2: { start:   '7.044', end: '109.397' },
  			 3: { start:  '10.417', end:  '60.943' },
  			 4: { start:  '17.168', end:  '72.025' },
  			 5: { start:  '24.000', end: '120.000' },
  			 6: { start:  '14.581', end:  '76.203' },
  			 7: { start:   '8.560', end:  '83.560' },
  			 8: { start:   '8.547', end:  '79.261' },
  			 9: { start:   '2.489', end:  '61.273' },
  			10: { start:  '12.648', end:  '81.981' },
  			11: { start:  '10.424', end:  '89.808' },
  			12: { start:   '7.861', end:  '73.079' },
  			13: { start:  '15.332', end:  '70.716' },
  			14: { start:   '8.368', end:  '92.089' },
  			15: { start:   '9.271', end:  '66.113' },
  			16: { start:  '28.429', end:  '78.955' },
  			17: { start:  '11.498', end: '110.129' },
  			18: { start:  '14.167', end:  '68.297' },
  			19: { start:  '12.978', end: '116.762' },
  			20: { start:   '9.167', end:  '63.167' },
  			21: { start:  '14.452', end:  '70.748' },
  			22: { start:  '16.852', end:  '83.519' },
  			23: { start:  '10.208', end:  '82.208' }
  		}
  	}
  };

  // Handles playing hourly music, KK, and the town tune.
  /* exported AudioManager */

  function AudioManager(addEventListener, isTownTune, notifyListenersArg) {

  	// Use the passed-in notifyListeners if available (offscreen), otherwise fallback to global or import
  	const notify = notifyListenersArg;

  	let audio = document.createElement('audio');
  	let killLoopTimeout;
  	let killFadeInterval;
  	let townTuneManager = new TownTuneManager();
  	new TimeKeeper();
  	let mediaSessionManager = new MediaSessionManager();
  	let kkVersion;
  	let previousWeather;
  	let previousGame;

  	let hourlyChange = false;
  	let townTunePlaying = false;
  	let isPlayingKK = false;

  	let setVolumeValue = 0.5;
  	let reduceVolumeValue = 0;
  	let reducedVolume = false;
  	let tabAudioPaused = false;
  	let pausedDuringTownTune = false;

  	// isHourChange is true if it's an actual hour change,
  	// false if we're activating music in the middle of an hour
         function playHourlyMusic(hour, weather, game, isHourChange) {
  	       printDebug('[AudioManager] playHourlyMusic called with arguments:', arguments.length, hour, weather, game, isHourChange);
  	       
  	       // Don't override KK music unless this is a real hourly change
  	       if (isPlayingKK && !isHourChange) {
  		       printDebug('[AudioManager] Ignoring hourMusic during KK mode (not hourly change)');
  		       return;
  	       }
  	       
  	       isPlayingKK = false;
  	       clearLoop();
  	       audio.loop = true;
  	       audio.removeEventListener("ended", playKKSong);

  	       let isWeatherChange = (previousWeather && !(previousWeather == weather));
  	       let noGameChange = previousGame && (previousGame == game);
  	       let noOtherChangesWeather = (noGameChange && !(isHourChange));
  	       let noOtherChangesHour = (noGameChange && !(isWeatherChange));

  	       // Badge notifications are handled by StateManager, not here to avoid infinite loops
  	       // if (notify) notify("hourMusic", [hour, weather, game, isHourChange]);

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

  	// Plays a song for an hour, setting up loop times if
  	// any exist
  	function playHourSong(game, weather, hour, skipIntro, started) {
  		audio.loop = true;

  		let seekTime = 0;
  		if (started) seekTime = audio.currentTime;

  		// STANDARD SONG NAME FORMATTING
  		let songName = formatHour$1(hour);

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

  		if (!tabAudioPaused) {
  			audio.currentTime = seekTime;
  			audio.play().then(() => {
  				setLoopTimes();
  				// Badge notifications are handled by StateManager, not here to avoid infinite loops
  				// if (notify) notify("tabAudio", [true, "play", reduceVolumeValue]);
  			}).catch(audioPlayError);
  		}

  		function setLoopTimes() {
  			// song has started
  			started = true;

  			// set up loop points if loopTime is set up for this
  			// game, hour and weather.
  			if (loopTime) {
  				printDebug("setting loop times. start:", loopTime.start, "end:", loopTime.end);

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
  			} else printDebug("no loop times found. looping full song");
  		}

  		mediaSessionManager.updateMetadata(game, hour, weather);
  	}

         function playKKMusic(_kkVersion) {
  	       kkVersion = _kkVersion;
  	       isPlayingKK = true;
  	       clearLoop();
  	       audio.loop = false;
  	       audio.onplay = null;
  	       audio.onpause = onPause;
  	       addEventListener("ended", playKKSong);
  	       fadeOutAudio(500, playKKSong);

  	       // Badge notifications are handled by StateManager, not here to avoid infinite loops  
  	       // if (notify) notify("kkStart", [_kkVersion]);

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

  			let formattedTitle = `${song.split(' - ')[1]} (${capitalize$1(version)} Version)`;
  			if (notify) notify("kkMusic", [formattedTitle]);

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
  			};
  		}
  	}

  	// If the music is paused via pressing the "close" button in the media session dialogue,
  	// then we gracefully handle it rather than going into an invalid state.
  	function onPause() {
  		if (hourlyChange) hourlyChange = false;
  		else {
  			// Badge notifications are handled by StateManager, not here to avoid infinite loops
  			// if (notify) notify("pause", [tabAudioPaused]);
  			if (killLoopTimeout) killLoopTimeout();
  			if (!tabAudioPaused) chrome.storage.local.setItem("paused", "true");
  		}
  	}

  	function setVolume() {
  		let newVolume = setVolumeValue;
  		if (reducedVolume) newVolume = newVolume * (1 - reduceVolumeValue / 100);

  		if (newVolume < 0) newVolume = 0;
  		if (newVolume > 1) newVolume = 1;

  		audio.volume = newVolume;
  	}

         addEventListener("hourMusic", playHourlyMusic);
         addEventListener("kkStart", playKKMusic);
         addEventListener("gameChange", function(hour, weather, game) {
  	       // Badge notifications are handled by StateManager, not here to avoid infinite loops
  	       // if (notify) notify("gameChange", [hour, weather, game]);
  	       // Don't override KK music with gameChange events
  	       if (isPlayingKK) {
  		       printDebug('[AudioManager] Ignoring gameChange during KK mode');
  		       return;
  	       }
  	       playHourlyMusic(hour, weather, game, false);
         });
         addEventListener("weatherChange", function(hour, weather, game) {
  	       // Badge notifications are handled by StateManager, not here to avoid infinite loops  
  	       // if (notify) notify("weatherChange", [hour, weather, game]);
  	       // Don't override KK music with weatherChange events
  	       if (isPlayingKK) {
  		       printDebug('[AudioManager] Ignoring weatherChange during KK mode');
  		       return;
  	       }
  	       playHourlyMusic(hour, weather, game, false);
         });

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
  		if (audible != null) {

  			if (audible) {
  				// Unpause/play
  				if (audio.paused && (audio.readyState >= 3 || audio.readyState == 0) && !townTunePlaying) {
  					audio.play();
  				}
  				tabAudioPaused = false;
  			} else {
  				// Pause
  				audio.pause();
  				tabAudioPaused = true;
  			}

  			// Handle volume reduction
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

  			// Badge notifications are handled by StateManager, not here to avoid infinite loops
  			// if (notify) notify("tabAudio", [audible, tabAudio, reduceValue]);
  		}
  	});

  	audio.onerror = audioPlayError;

  	function audioPlayError() {
  		if (notify) notify("musicFailed");
  	}
  }

  // Singleton event system for AudioManager
  const callbacks = {};
  function addEventListener(event, callback) {
      if (!callbacks[event]) callbacks[event] = [];
      callbacks[event].push(callback);
  }


  // Register all relevant event handlers for AudioManager
  const badgeEvents = [
      'hourMusic', 'kkStart', 'gameChange', 'weatherChange', 'pause', 'tabAudio', 'musicFailed'
  ];
  AudioManager(addEventListener, () => false, function(event, args, source) {
      notifyOffscreenListeners(event, args, source);
  });

  // Register handlers for all events that may be sent from the service worker

  function notifyOffscreenListeners(event, args, source) {
      console.log('[offscreen.js] notifyOffscreenListeners called with:', {event, args, argsType: typeof args, argsLength: Array.isArray(args) ? args.length : 'not array', source});
      const callbackArr = callbacks[event] || [];
      // Always call every callback for the event with ...args (spread array)
      for (let i = 0; i < callbackArr.length; i++) {
          if (Array.isArray(args)) {
              callbackArr[i](...args);
          } else {
              console.warn('[offscreen.js] args is not an array:', args);
              callbackArr[i](args);
          }
      }
      // Only forward badge-relevant events to service worker
      if (source !== false && badgeEvents.includes(event)) {
          console.log('[offscreen.js] notifyOffscreenListeners called for badge event:', event, args, JSON.stringify(args));
          // Temporarily disable badge forwarding to test music playback
          if (Array.isArray(args) && args.length > 0) {
              try {
                  chrome.runtime.sendMessage({
                      type: event,
                      target: 'service-worker',
                      data: args
                  }, function(response) {
                      if (chrome.runtime.lastError) {
                          console.warn('[offscreen.js] Could not send badge event to service-worker:', chrome.runtime.lastError.message);
                      } else {
                          console.log('[offscreen.js] Badge event sent to service-worker, response:', response);
                      }
                  });
              } catch (e) {
                  console.warn('[offscreen.js] Exception sending badge event to service-worker:', e);
              }
          } else {
              console.warn('[offscreen.js] Skipping badge event with invalid args:', event, args);
          }
      }
  }
  globalThis.notify = notifyOffscreenListeners;


  function handleMessages(message, sender, sendResponse) {
      if (message && message.target === 'offscreen-doc') {
          if (callbacks[message.type]) {
              callbacks[message.type].forEach(cb => cb(...message.data));
          }
      } else {
          printDebug('[offscreen.js] No handler registered for', message.type);
      }
  }

  chrome.runtime.onMessage.addListener(handleMessages);

})();
