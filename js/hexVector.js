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

    return {
        init: function() {
            //Load resources
            loadRequest(_this.soundFontURL, _this.instruments[0], function(responseText) {
                console.log("Loaded soundfont file");
                var script = document.createElement('script');
                script.language = 'javascript';
                script.type = 'text/javascript';
                script.text = responseText;
                document.body.appendChild(script);
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
                this.replayer = Replayer(this.midiFile, this.synth);
                this.audio = AudioPlayer(this.replayer);
            })
        },

        muteTrack: function(trackNumber, muteStatus) {
            _this.replayer.setMuteTrack(trackNumber, muteStatus);
        }
    }
})();

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
