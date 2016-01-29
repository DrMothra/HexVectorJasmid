/**
 * Created by DrTone on 29/01/2016.
 */


var replayer;
function loadRemote(path, callback) {
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
}

function play(file) {
    loadRemote(file, function(data) {
        midiFile = MidiFile(data);
        synth = Synth(44100);
        replayer = Replayer(midiFile, synth);
        //replayer.setMuteTrack(6, true);
        audio = AudioPlayer(replayer);
    })
}

function mute(muteStatus) {
    //for(var i=1; i<=6; ++i) {
        replayer.setMuteTrack(6, muteStatus);
    //}
}

$(document).ready(function() {

    $('#play').on("click", function() {
        play("audio/MIDIMaster.mid");
    });

    var muteTrack = false;
    $('#mute').on("click", function() {
        muteTrack = !muteTrack;
        mute(muteTrack);
    })
});
