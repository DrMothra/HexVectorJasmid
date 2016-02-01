/**
 * Created by DrTone on 29/01/2016.
 */

var midiManager = ( function() {
    var _this = this;
    this.replayer = null;
    this.midiFile = null;
    this.synth = null;
    this.audio = null;
    this.SAMPLERATE = 44100;
    this.midiFilename = '';
    this.soundFontURL = "./soundfont/";
    this.instruments = ['acoustic_grand_piano'];
    this.keyToNote = {};
    this.audioContext = null;
    this.audioBuffers = {};

    return {
        init: function() {
            _this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            setupNotes(_this.keyToNote);
            //Load resources
            loadRequest(_this.soundFontURL, _this.instruments[0], function() {
                //Load in audio files
                //DEBUG
                console.log("About to load audio files");
                loadAudioFiles(_this.audioContext, _this.keyToNote, _this.instruments[0], _this.audioBuffers, function() {
                    //DEBUG
                    console.log("All audio files loaded");
                });
            });
        },

        loadRemoteFile: function(path, callback) {
            var fetch = new XMLHttpRequest();
            fetch.open('GET', path);
            fetch.overrideMimeType("text/plain; charset=x-user-defined");
            fetch.onreadystatechange = function() {
                if(this.readyState == 4 && this.status == 200) {
                    /* munge response into a binary string */
                    var t = this.responseText || "" ;
                    var ff = [];
                    var mx = t.length;
                    var scc= String.fromCharCode;
                    for (var z = 0; z < mx; z++) {
                        ff[z] = scc(t.charCodeAt(z) & 255);
                    }
                    callback(ff.join(""));
                }
            };
            fetch.send();
        },

        play: function(file) {
            this.loadRemoteFile(file, function(data) {
                this.midiFile = MidiFile(data);
                this.synth = Synth(this.SAMPLERATE);
                this.replayer = Replayer(this.midiFile, this.synth, this.audioBuffers);
                var midiData = this.replayer.getData();
                this.audio = AudioPlayer(this.replayer, this.audioBuffers, midiData);
            })
        },

        muteTrack: function(trackNumber, muteStatus) {
            _this.replayer.setMuteTrack(trackNumber, muteStatus);
        }
    }
})();

function setupNotes(notes) {
    var A0 = 0x15; // first note
    var C8 = 0x6C; // last note
    var number2key = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (var n = A0; n <= C8; n++) {
        var octave = (n - 12) / 12 >> 0;
        var name = number2key[n % 12] + octave;
        notes[name] = n;
    }
}

$(document).ready(function() {

    midiManager.init();

    $('#play').on("click", function() {
        midiManager.play("audio/MIDIMaster.mid");
    });

    var muteTrack = false;
    $('#mute').on("click", function() {
        muteTrack = !muteTrack;
        midiManager.muteTrack(6, muteTrack);
        midiManager.muteTrack(5, muteTrack);
        midiManager.muteTrack(4, muteTrack);
    })
});
