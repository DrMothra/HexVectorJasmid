var clone = function (o) {
	if (typeof o != 'object') return (o);
	if (o == null) return (o);
	var ret = (typeof o.length == 'number') ? [] : {};
	for (var key in o) ret[key] = clone(o[key]);
	return ret;
};

function Replayer(midiFile, synth, soundBuffers) {
	var trackStates = [];
	var beatsPerMinute = 120;
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

	for (var i = 0; i < midiFile.tracks.length; i++) {
		trackMute.push(false);
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

	function processAudioEvents(currentTime, nextTimeInterval, data) {
		var keepProcessing = true;
		var delay, event, time, obj;
		while(keepProcessing) {
			obj = data[currentEvent];
			event = obj[0];
			time = obj[1];
			playbackTime += time;
			delay = playbackTime - currentTime;
			if(delay < 0) delay = 0;
			++currentEvent;
			if((currentTime + nextTimeInterval) >= playbackTime) {
				//DEBUG
				//console.log("Ticks = ", nextEventInfo.ticksToEvent);
				if(playbackTime === 0) continue;
				event.delay = delay;
				eventsToProcess.push(event);
			} else {
				//Don't miss latest event
				event.delay = delay;
				eventsToProcess.push(event);
				keepProcessing = false;
			}
		}
		for(var j=0; j<eventsToProcess.length; ++j) {
			handleEvent(eventsToProcess[j]);
		}
		eventsToProcess = [];
	}
	/*
	function processEvents(currentTime, nextTimeInterval) {
		//Get and process midi events
		//DEBUG
		//console.log("Current = ", currentTime);
		var keepProcessing = true;
		var delay, type;
		while(keepProcessing) {
			getNextEvent();
			//DEBUG
			type = nextEventInfo.event.type;
			switch(type) {
				case 'meta':
					console.log("Meta");
					break;
				case 'channel':
					switch (nextEventInfo.subtype) {
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

			if(nextEventInfo === null) break;
			playbackTime += nextEventInfo.ticksToEvent;
			//DEBUG
			//console.log("Playback = ", playbackTime);
			delay = playbackTime - currentTime;
			if(delay < 0) delay = 0;
			if((currentTime + nextTimeInterval) >= playbackTime) {
				//DEBUG
				//console.log("Ticks = ", nextEventInfo.ticksToEvent);
				nextEventInfo.delay = delay;
				eventsToProcess.push(nextEventInfo);
			} else {
				//Don't miss latest event
				nextEventInfo.delay = delay;
				eventsToProcess.push(nextEventInfo);
				keepProcessing = false;
			}
		}
		//DEBUG
		//console.log("Events = ", eventsToProcess.length);
		for(var i=0; i<eventsToProcess.length; ++i) {
			handleEvent(eventsToProcess[i]);
		}
		eventsToProcess = [];
	}
	*/

	function handleEvent(eventInfo) {
		var event = eventInfo.event;
		var track = eventInfo.track;
		var delay = eventInfo.delay;

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
						//channels[event.channel].noteOn(event.noteNumber, event.velocity);

                        var channel = 0;
                        var instrument = 0;
                        var noteNum = event.noteNumber;
						//DEBUG
						console.log("On = ", noteNum);
                        if(noteNum === undefined) {
                            noteNum = 21;
                        }
                        var bufferId = instrument + '' + noteNum.toString();
                        var buffer = audioBuffers[bufferId];
                        var source = context.createBufferSource();
                        source.buffer = buffer;

                        var gain = (event.velocity / 127) * (127 / 127) * 2 - 1;
                        source.connect(context.destination);
                        source.playbackRate.value = 1; // pitch shift
                        source.gainNode = context.createGain(); // gain
                        source.gainNode.connect(context.destination);
                        source.gainNode.gain.value = Math.min(1.0, Math.max(-1.0, gain));
                        source.connect(source.gainNode);

                        source.start(delay);
                        var channelId = 0;
                        sources[channelId + '' + noteNum.toString()] = source;

						break;
					case 'noteOff':
						//channels[event.channel].noteOff(event.noteNumber, event.velocity);

                        var channel = 0;
						var channelId = 0;
                        var instrument = 0;
                        var noteNum = event.noteNumber;
						//DEBUG
						console.log("Off = ", noteNum);
                        var bufferId = instrument + '' + noteNum.toString();
                        var buffer = audioBuffers[bufferId];
                        if (buffer) {
                            var source = sources[channelId + '' + noteNum.toString()];
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
                                delete sources[channelId + '' + noteNum.toString()];
                            }
                        }

						break;
					case 'programChange':
						//console.log('program change to ' + event.programNumber);
						channels[event.channel].setProgram(event.programNumber);
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

	function getData() {
		return clone(temporal);
	}

	return {
		'replay': replay,
		'setMuteTrack': setMuteTrack,
		'processEvents': processEvents,
		"getData": getData,
		'processAudioEvents': processAudioEvents
	};
}
