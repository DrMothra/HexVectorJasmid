function Replayer(midiFile, synth, soundBuffers) {
	var trackStates = [];
	var beatsPerMinute = 120;
	var ticksPerBeat = midiFile.header.ticksPerBeat;
	var channelCount = 16;
	var trackMute = [];
    var audioBuffers = soundBuffers;
    var sources = {};
	
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
	
	function Channel() {
		
		var generatorsByNote = {};
		var currentProgram = PianoProgram;
		
		function noteOn(note, velocity) {
			if (generatorsByNote[note] && !generatorsByNote[note].released) {
				/* playing same note before releasing the last one. BOO */
				generatorsByNote[note].noteOff(); /* TODO: check whether we ought to be passing a velocity in */
			}
			generator = currentProgram.createNote(note, velocity);
			synth.addGenerator(generator);
			generatorsByNote[note] = generator;
		}
		function noteOff(note, velocity) {
			if (generatorsByNote[note] && !generatorsByNote[note].released) {
				generatorsByNote[note].noteOff(velocity);
			}
		}
		function setProgram(programNumber) {
			currentProgram = PROGRAMS[programNumber] || PianoProgram;
		}
		
		return {
			'noteOn': noteOn,
			'noteOff': noteOff,
			'setProgram': setProgram
		}
	}
	
	var channels = [];
	for (var i = 0; i < channelCount; i++) {
		channels[i] = Channel();
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
			nextEventInfo = {
				'ticksToEvent': ticksToNextEvent,
				'event': nextEvent,
				'track': nextEventTrack
			}
			var beatsToNextEvent = ticksToNextEvent / ticksPerBeat;
			var secondsToNextEvent = beatsToNextEvent / (beatsPerMinute / 60);
			samplesToNextEvent += secondsToNextEvent * synth.sampleRate;
		} else {
			nextEventInfo = null;
			samplesToNextEvent = null;
			self.finished = true;
		}
	}
	
	getNextEvent();
	
	function generate(samples, context) {
		var data = new Array(samples*2);
        var audioBuffer;
		var samplesRemaining = samples;
		var dataOffset = 0;
		
		while (true) {
			if (samplesToNextEvent != null && samplesToNextEvent <= samplesRemaining) {
				/* generate samplesToNextEvent samples, process event and repeat */
				var samplesToGenerate = Math.ceil(samplesToNextEvent);
				if (samplesToGenerate > 0) {
					synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
					dataOffset += samplesToGenerate * 2;
					samplesRemaining -= samplesToGenerate;
					samplesToNextEvent -= samplesToGenerate;
				}
				
				handleEvent(context);
				getNextEvent();
			} else {
				/* generate samples to end of buffer */
				if (samplesRemaining > 0) {
					synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
					samplesToNextEvent -= samplesRemaining;
				}
                //Use soundfont data
                /*
                var channel = 0;
                var instrument = 0;
                var noteNum = nextEventInfo.event.noteNumber;
                if(noteNum === undefined) {
                    noteNum = 21;
                }
                var bufferId = instrument + '' + noteNum.toString();
                audioBuffer = audioBuffers[bufferId];
                */
				break;
			}
		}
		//return data;
        return audioBuffer;
	}
	
	function handleEvent(context) {
		var event = nextEventInfo.event;
		var track = nextEventInfo.track;
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
						channels[event.channel].noteOn(event.noteNumber, event.velocity);
                        var channel = 0;
                        var instrument = 0;
                        var noteNum = nextEventInfo.event.noteNumber;
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

                        source.start(0);
                        var channelId = 0;
                        sources[channelId + '' + noteNum.toString()] = source;

						break;
					case 'noteOff':
						channels[event.channel].noteOff(event.noteNumber, event.velocity);
                        var channel = 0;
                        var instrument = 0;
                        var noteNum = nextEventInfo.event.noteNumber;
                        var bufferId = instrument + '' + noteNum.toString();
                        var buffer = audioBuffers[bufferId];
                        if (buffer) {
                            var source = sources[channelId + '' + noteNum.toString()];
                            if (source) {
                                if (source.gainNode) {
                                    // @Miranet: 'the values of 0.2 and 0.3 could of course be used as
                                    // a 'release' parameter for ADSR like time settings.'
                                    // add { 'metadata': { release: 0.3 } } to soundfont files
                                    //var gain = source.gainNode.gain;
                                    //gain.linearRampToValueAtTime(gain.value, delay);
                                    //gain.linearRampToValueAtTime(-1.0, delay + 0.3);
                                }
                                ///
                                if (source.noteOff) {
                                    source.noteOff(0.5);
                                } else {
                                    source.stop(0.5);
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

	var self = {
		'replay': replay,
		'generate': generate,
		'setMuteTrack': setMuteTrack,
		'finished': false
	}
	return self;
}
