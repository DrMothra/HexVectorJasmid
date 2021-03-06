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
	var trackToInstrument = [];
	var eventsToProcess = [];
    var audioBuffers = soundBuffers;
    var sources = {};
	var webkitAudio = window.AudioContext || window.webkitAudioContext;
	var context = new webkitAudio();
	var playbackRate = 1;
	var filterFrequency = 1000;
	var filterGain = 0;
	var currentEvent = 0;
	var masterVolume = 127;
	var counter = 0;

	for (var i = 0; i < midiFile.tracks.length; i++) {
		trackMute.push(true);
		trackToInstrument.push(0);
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

	var currentTime = 0, playbackTime = 0.5, lastTime = 0;
	function processAudioEvents(elapsed, lookAheadInterval, data) {
		var keepProcessing = true;
		var delay, event, time, obj, delayOffset = 1;
		var dataLength = data.length;
		var maxLookAheadTime = (lookAheadInterval * 2);

		if((currentTime - elapsed) >= maxLookAheadTime) {
			//DEBUG
			//console.log("current = ", currentTime, " elapsed = ", elapsed);
			return;
		}

		while(keepProcessing) {
			if(currentEvent >= dataLength) {
				return true;
			}

			obj = data[currentEvent++];

			event = obj[0];
			time = obj[1];
			playbackTime += time;

			if(playbackTime <= currentTime) {
				lastTime = playbackTime;
				continue;
			}
			currentTime = playbackTime - lastTime;

			if(event.event.type === 'meta' || event.event.subtype === 'controller') continue;

			delay = currentTime - elapsed;
			//DEBUG
			//console.log("Note = ", event.event.noteNumber, " msg = ", event.event.subtype, " time = ", currentTime, counter++);
			if(delay < 0) {
				delay = 0;
			}
			event.delay = (delay/1000).toFixed(3);

			eventsToProcess.push(event);
			if(delay >= (lookAheadInterval * 2)) {
				break;
			}
		}
		for(var j=0; j<eventsToProcess.length; ++j) {
			handleEvent(eventsToProcess[j]);
		}
		eventsToProcess = [];

		return false;
	}

	function reset() {
		currentEvent = 0;
		playbackTime = 0.5;
		currentTime = 0;
		lastTime = 0;
		//counter = 0;
	}

	function handleEvent(eventInfo) {
		var event = eventInfo.event;
		var track = eventInfo.track;
		var delay = eventInfo.delay;

		var channel = 0, channelId = 0;
		var noteNum, noteId, bufferId, buffer, source, gain;

		switch (event.type) {
			case 'meta':
				switch (event.subtype) {
					case 'setTempo':
						beatsPerMinute = 60000000 / event.microsecondsPerBeat
				}
				break;
			case 'channel':
					var instrument = trackToInstrument[track];
					if(instrument === undefined) instrument = 0;

				switch (event.subtype) {
					case 'noteOn':
						//DEBUG
                        var velocity = event.velocity;
						//$('#debug').html(velocity);

                        noteNum = event.noteNumber;
						//$('#debug').html(noteNum + " + " + delay);
						//DEBUG
						//if(track === 2) {
						//	console.log("Note = ", noteNum);
						//}
						//DEBUG
                        //console.log("On = ", noteNum);

						noteId = noteNum.toString();
                        bufferId = instrument + '' + noteId;
                        buffer = audioBuffers[bufferId];
						if(buffer === undefined){
							//DEBUG
							//console.log("No note ", bufferId);
							break;
						}
                        source = context.createBufferSource();
                        source.buffer = buffer;

                        gain = (velocity / masterVolume) * 2;
						if(trackMute[track]) {
							gain = 0.001;
							//DEBUG
							//console.log("Track ", track, " muted");
						}
						//source.connect(context.destination);
						var filter = context.createBiquadFilter();
						filter.type = "peaking";
						filter.frequency.value = filterFrequency;
						//filter.detune.value = 0;
						filter.gain.value = filterGain;
						filter.Q.value = 0.6;
                        source.connect(filter);
                        source.playbackRate.value = playbackRate; // pitch shift
                        source.gainNode = context.createGain(); // gain
						//source.connect(source.gainNode);
						filter.connect(source.gainNode);
						//filter.connect(context.destination);
						source.gainNode.connect(context.destination);
                        //source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
						source.gainNode.gain.value = gain;

                        source.start(delay);
                        //channelId = 0;
                        //sources[channelId + '' + noteId] = source;

						break;
					case 'noteOff':
						//DEBUG
						//break;

						noteNum = event.noteNumber;
						//DEBUG
						//console.log("Off = ", noteNum, " count = ", ++counter);

						noteId = noteNum.toString(); bufferId = instrument + '' + noteId;
                        buffer = audioBuffers[bufferId];
                        if (buffer) {
                            source = sources[channelId + '' + noteId];
                            if (source) {
                                //delete sources[channelId + '' + noteId];

                                if (source.gainNode) {
                                    // @Miranet: 'the values of 0.2 and 0.3 could of course be used as
                                    // a 'release' parameter for ADSR like time settings.'
                                    // add { 'metadata': { release: 0.3 } } to soundfont files
                                    gain = source.gainNode.gain;
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

					default:
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

	function setTrackMapping(track, instrument) {
		if(track > trackToInstrument.length) {
			//DEBUG
			console.log("Track too big!");
			return;
		}
		trackToInstrument[track] = instrument;
	}

	function setPlaybackRate(rate) {
		playbackRate = rate;
	}

	function setFilterFrequency(freq, gain) {
		filterFrequency = freq;
		filterGain = gain;
	}
	function getData() {
		return clone(temporal);
	}

	return {
		'replay': replay,
		'setMuteTrack': setMuteTrack,
        'muteAllTracks': muteAllTracks,
		'processEvents': processEvents,
		'setTrackMapping': setTrackMapping,
		'reset': reset,
		'setPlaybackRate': setPlaybackRate,
		'setFilterFrequency': setFilterFrequency,
		"getData": getData,
		'processAudioEvents': processAudioEvents
	};
}
