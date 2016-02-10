var sampleRate = 44100; /* hard-coded in Flash player */

function AudioPlayer(generator, midiData, userId, opts) {
	if (!opts) opts = {};
	var latency = opts.latency || 1;
	var checkInterval = latency * 100 /* in ms */
	
	var audioElement = new Audio();
	var webkitAudio = window.AudioContext || window.webkitAudioContext;
	var requestStop = false;
	var currentPlaybackTime = -1;
	var server = false;
	if(userId.indexOf('server') !== -1) {
		server = true;
	}
	
	if (audioElement.mozSetup) {
		audioElement.mozSetup(2, sampleRate); /* channels, sample rate */
		
		var buffer = []; /* data generated but not yet written */
		var minBufferLength = latency * 2 * sampleRate; /* refill buffer when there are only this many elements remaining */
		var bufferFillLength = Math.floor(latency * sampleRate);
		
		function checkBuffer() {
			if (buffer.length) {
				var written = audioElement.mozWriteAudio(buffer);
				buffer = buffer.slice(written);
			}
			if (buffer.length < minBufferLength && !generator.finished) {
				buffer = buffer.concat(generator.generate(bufferFillLength));
			}
			if (!requestStop && (!generator.finished || buffer.length)) {
				setTimeout(checkBuffer, checkInterval);
			}
		}
		checkBuffer();
		
		return {
			'type': 'Firefox Audio',
			'stop': function() {
				requestStop = true;
			}
		}
	} else if (webkitAudio) {
		// Uses Webkit Web Audio API if available
		//var context = new webkitAudio();
		//sampleRate = context.sampleRate;

		var eventCheckTime = 25;
		var start = Date.now(), now;
		if(server) {

			var processServerTimer = setInterval(function() {
				now = Date.now();
				currentPlaybackTime = now-start;
				$('#debug').html(currentPlaybackTime);
				if(generator.processAudioEvents(currentPlaybackTime, eventCheckTime, midiData)) {
					console.log("All events processed");
					generator.reset();
					start = now;
				}

			}, eventCheckTime);
		} else {
			var processClientTimer = setInterval(function() {
				now = Date.now();
				if(currentPlaybackTime !== -1) {
					//DEBUG
					//console.log("Current playback = ", currentPlaybackTime);
					currentPlaybackTime += (now - start);
					start = now;
					$('#debug').html(currentPlaybackTime);
					if(generator.processAudioEvents(currentPlaybackTime, eventCheckTime, midiData)) {
						//DEBUG
						//console.log("All events processed");
						generator.reset();
						start = now;
						currentPlaybackTime = 0;
					}
				} else {
					start = now;
				}

			}, eventCheckTime);
		}

		return {
			'stop': function() {
				// pause
				node.disconnect();
				requestStop = true;
			},
			'type': 'Webkit Audio',
			'getCurrentPlaybackTime' : function() {
				return currentPlaybackTime;
			},

			'setCurrentPlaybackTime': function(time) {
				currentPlaybackTime = time;
				//DEBUG
				//$('#debug').html(time);
			}
		}

	} else {
		// Fall back to creating flash player
		var c = document.createElement('div');
		c.innerHTML = '<embed type="application/x-shockwave-flash" id="da-swf" src="da.swf" width="8" height="8" allowScriptAccess="always" style="position: fixed; left:-10px;" />';
		document.body.appendChild(c);
		var swf = document.getElementById('da-swf');
		
		var minBufferDuration = latency * 1000; /* refill buffer when there are only this many ms remaining */
		var bufferFillLength = latency * sampleRate;
		
		function write(data) {
			var out = new Array(data.length);
			for (var i = data.length-1; i != 0; i--) {
				out[i] = Math.floor(data[i]*32768);
			}
			return swf.write(out.join(' '));
		}
		
		function checkBuffer() {
			if (swf.bufferedDuration() < minBufferDuration) {
				write(generator.generate(bufferFillLength));
			};
			if (!requestStop && !generator.finished) setTimeout(checkBuffer, checkInterval);
		}
		
		function checkReady() {
			if (swf.write) {
				checkBuffer();
			} else {
				setTimeout(checkReady, 10);
			}
		}
		checkReady();
		
		return {
			'stop': function() {
				swf.stop();
				requestStop = true;
			},
			'bufferedDuration': function() {
				return swf.bufferedDuration();
			},
			'type': 'Flash Audio'
		}
	}
}
