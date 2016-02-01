var clone = function (o) {
	if (typeof o != 'object') return (o);
	if (o == null) return (o);
	var ret = (typeof o.length == 'number') ? [] : {};
	for (var key in o) ret[key] = clone(o[key]);
	return ret;
};

function Replayer(midiFile, synth, soundBuffers) {
	var trackStates = [];
	var beatsPerMinute = 68;
	var ticksPerBeat = midiFile.header.ticksPerBeat;
	var channelCount = 16;
	var trackMute = [];
	var eventsToProcess = [];
    var audioBuffers = soundBuffers;
    var sources = {};
	var webkitAudio = window.AudioContext || window.webkitAudioContext;
	var context = new webkitAudio();
	var playbackTime = 0;
	var currentEvent = 0;
	var masterVolume = 127;
	var counter = 0;

	for (var i = 0; i < midiFile.tracks.length; i++) {
		trackMute.push(true);
		trackStates[i] = {
			'nextEventIndex': 0,
			'ticksToNextEvent': (
				midiFile.tracks[i].length ?
					midiFile.tracks[i][0].deltaTime :
					null
			)
		};
	}
	
	var nextEventInfo;
	var samplesToNextEvent = 0;
	
	function getNextEvent() {
		var ticksToNextEvent = null;
		var nextEventTrack = null;
		var nextEventIndex = null;
		
		for (var i = 0; i < trackStates.length; i++) {
			if (
				trackStates[i].ticksToNextEvent != null
				&& (ticksToNextEvent == null || trackStates[i].ticksToNextEvent < ticksToNextEvent)
			) {
				ticksToNextEvent = trackStates[i].ticksToNextEvent;
				nextEventTrack = i;
				nextEventIndex = trackStates[i].nextEventIndex;
			}
		}
		if (nextEventTrack != null) {
			/* consume event from that track */
			var nextEvent = midiFile.tracks[nextEventTrack][nextEventIndex];
			if (midiFile.tracks[nextEventTrack][nextEventIndex + 1]) {
				trackStates[nextEventTrack].ticksToNextEvent += midiFile.tracks[nextEventTrack][nextEventIndex + 1].deltaTime;
			} else {
				trackStates[nextEventTrack].ticksToNextEvent = null;
			}
			trackStates[nextEventTrack].nextEventIndex += 1;
			/* advance timings on all tracks by ticksToNextEvent */
			for (var i = 0; i < trackStates.length; i++) {
				if (trackStates[i].ticksToNextEvent != null) {
					trackStates[i].ticksToNextEvent -= ticksToNextEvent
				}
			}
			return {
				'ticksToEvent': ticksToNextEvent,
				'event': nextEvent,
				'track': nextEventTrack
			}

		} else {
			return null;
		}
	}

	var midiEvent;
	var temporal = [];
	//
	function processEvents() {
		var timeWarp = 1;
		function processNext() {
			///
			var beatsToGenerate = 0;
			var secondsToGenerate = 0;
			if (midiEvent.ticksToEvent > 0) {
				beatsToGenerate = midiEvent.ticksToEvent / ticksPerBeat;
				secondsToGenerate = beatsToGenerate / (beatsPerMinute / 60);
			}
			///
			var time = (secondsToGenerate * 1000 * timeWarp) || 0;
			temporal.push([ midiEvent, time]);
			midiEvent = getNextEvent();
		};
		///
		if (midiEvent = getNextEvent()) {
			while(midiEvent) processNext(true);
		}
	}

	processEvents();

	/*
	function checkEvents(currentTime, nextTimeInterval) {
		while(true) {
			getNextEvent();
			//DEBUG
			var type = nextEventInfo.event.type;
			switch(type) {
				case 'meta':
					console.log("Meta");
					break;
				case 'channel':
					switch (nextEventInfo.event.subtype) {
						case 'noteOn':
							console.log("Note on = ", nextEventInfo.event.noteNumber);
							break;
						case 'noteOff':
							console.log("Note off = ", nextEventInfo.event.noteNumber);
							break;
						default:
							break;
					}
					break;
				default:
					break;
			}
		}
	}
	*/

	function processAudioEvents(currentTime, nextTimeInterval, data) {
		var keepProcessing = true;
		var delay, event, time, obj;
		var dataLength = data.length;
		//DEBUG
		//if(counter === 0) {
		//	console.log("Current time = ", currentTime);
		//	counter = 1;
		//}

		while(keepProcessing) {
			if(currentEvent >= dataLength) break;
			obj = data[currentEvent]; //DEBUG
			//console.log("Current event =", currentEvent);
			event = obj[0];
			time = obj[1];
			playbackTime += time;
			//DEBUG
			//console.log("Playback = ", playbackTime);
			++currentEvent;
			if(playbackTime < currentTime) continue;
			if(event.event.type === 'meta') continue;
			delay = playbackTime - currentTime;
			if(delay < 0) delay = 0;
			if(playbackTime >= currentTime && playbackTime <= (currentTime + nextTimeInterval)) {
				event.delay = delay/1000;
				eventsToProcess.push(event);
			} else {
				--currentEvent;
				playbackTime -= time;
				keepProcessing = false;
			}
		}
		for(var j=0; j<eventsToProcess.length; ++j) {
			handleEvent(eventsToProcess[j]);
		}
		eventsToProcess = [];
		return (currentEvent >= dataLength);
	}

	function reset() {
		currentEvent = 0;
		playbackTime = 0;
		counter = 0;
	}

	function handleEvent(eventInfo) {
		var event = eventInfo.event;
		var track = eventInfo.track;
		var delay = eventInfo.delay;
		var channel = 0, channelId = 0, instrument = 0;
		var noteNum, noteId, bufferId, buffer, source, gain;

		switch (event.type) {
			case 'meta':
				switch (event.subtype) {
					case 'setTempo':
						beatsPerMinute = 60000000 / event.microsecondsPerBeat
				}
				break;
			case 'channel':
				switch (event.subtype) {
					case 'noteOn':

						if(trackMute[track]) event.velocity = 0;

                        noteNum = event.noteNumber;
						//DEBUG
						//if(++counter < 30) {
						//	console.log("On = ", noteNum, " delay = ", delay);
						//}

                        if(noteNum === undefined) {
                            noteNum = 21;
                        }
						noteId = noteNum.toString();
                        bufferId = instrument + '' + noteId;
                        buffer = audioBuffers[bufferId];
                        source = context.createBufferSource();
                        source.buffer = buffer;

                        gain = (event.velocity / 127) * (masterVolume / 127) * 2 - 1;
                        source.connect(context.destination);
                        source.playbackRate.value = 1; // pitch shift
                        source.gainNode = context.createGain(); // gain
                        source.gainNode.connect(context.destination);
                        source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
                        source.connect(source.gainNode);

                        source.start(delay);
                        channelId = 0;
                        sources[channelId + '' + noteId] = source;

						break;
					case 'noteOff':
						//channels[event.channel].noteOff(event.noteNumber, event.velocity);

                        noteNum = event.noteNumber;
						//DEBUG
						//DEBUG
						//if(++counter < 30) {
						//	console.log("Off = ", noteNum, " delay = ", delay);
						//}
						noteId = noteNum.toString();
                        bufferId = instrument + '' + noteId;
                        buffer = audioBuffers[bufferId];
                        if (buffer) {
                            source = sources[channelId + '' + noteId];
                            if (source) {
                                if (source.gainNode) {
                                    // @Miranet: 'the values of 0.2 and 0.3 could of course be used as
                                    // a 'release' parameter for ADSR like time settings.'
                                    // add { 'metadata': { release: 0.3 } } to soundfont files
                                    var gain = source.gainNode.gain;
                                    gain.linearRampToValueAtTime(gain.value, delay);
                                    gain.linearRampToValueAtTime(-1.0, delay + 0.3);
                                }
                                ///
                                if (source.noteOff) {
                                    source.noteOff(delay + 0.5);
                                } else {
                                    source.stop(delay + 0.5);
                                }

                                ///
                                //delete sources[channelId + '' + noteId];
                            }
                        }

						break;
					case 'programChange':
						console.log('program change to ' + event.programNumber);
						break;
				}
				break;
		}
	}
	
	function replay(audio) {
		console.log('replay');
		audio.write(generate(44100));
		setTimeout(function() {replay(audio)}, 10);
	}

	function setMuteTrack(trackNumber, muteStatus) {
		trackMute[trackNumber] = muteStatus;
	}

    function muteAllTracks() {
        for(var i=0; i<trackMute.length; ++i) {
            trackMute[i] = true;
        }
    }

	function getData() {
		return clone(temporal);
	}

	return {
		'replay': replay,
		'setMuteTrack': setMuteTrack,
        'muteAllTracks': muteAllTracks,
		'processEvents': processEvents,
		'reset': reset,
		"getData": getData,
		'processAudioEvents': processAudioEvents
	};
}
