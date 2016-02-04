/**
 * Created by DrTone on 29/01/2016.
 */

//Load all soundfonts

Soundfont = {};

function loadRequest(soundfontpath, instrument, onLoaded) {
    var url = soundfontpath + instrument + '-mp3.js';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function(event) {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                var response = event.target.responseText;
                console.log("Loaded soundfont file");
                var script = document.createElement('script');
                script.language = 'javascript';
                script.type = 'text/javascript';
                script.text = response;
                document.body.appendChild(script);
                onLoaded();
            } else {
                console.log("Couldn't load soundfont file!");
            }
        }
    };

    xhr.send();
}

function loadAudioFiles(context, notes, instrument, instrumentId, audioBuffers, onLoad) {
    //Load in audio file for each note
    var urls = [];
    var bufferPending = {};
    var key;

    for (key in notes) urls.push(key);
    var numFiles = urls.length, currentFile = 0;
    var soundfont = Soundfont[instrument];


    var waitForEnd = function() {
        for (var key in bufferPending) { // has pending items
            if (bufferPending[key]) return;
        }

        onLoad();
    };

    var requestAudio = function(soundfont, instrumentId, index, key) {
        var url = soundfont[key];
        if (url) {
            bufferPending[instrumentId] ++;
            loadAudio(context, url, function(buffer) {
                buffer.id = key;
                var noteId = notes[key];
                audioBuffers[instrumentId + '' + noteId] = buffer;
                ///
                if (-- bufferPending[instrumentId] === 0) {
                    soundfont.isLoaded = true;
                    waitForEnd(instrument);
                }
            }, function(err) {
                console.log(err);
            });
        }
    };

    bufferPending[instrumentId] = 0;

    for (var index = 0; index < numFiles; ++index) {
        key = urls[index];
        requestAudio(soundfont, instrumentId, index, key);
    }

    setTimeout(waitForEnd, 1);
}

function loadAudio(ctx, url, onload, onerror) {
    if (url.indexOf('data:audio') === 0) { // Base64 string
        var base64 = url.split(',')[1];
        var buffer = Base64Binary.decodeArrayBuffer(base64);
        ctx.decodeAudioData(buffer, onload, onerror);
    }
}