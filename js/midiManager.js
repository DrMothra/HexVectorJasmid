/**
 * Created by atg on 09/02/2016.
 */

//Manages midi laoding and playing
var MidiManager = function() {
    this.replayer = null;
    this.midiFile = null;
    this.SAMPLERATE = 44100;
    this.soundFontURL = "./soundfont/";
    this.instruments = ['string_ensemble_1', 'electric_grand_piano', 'synth_strings_1', 'bell_Motif', 'rising_Melody', 'marimba'];
    //this.instruments = ['acoustic_grand_piano'];
    this.audioContext = null;
    this.audioBuffers = {};
    this.keyToNote = {};
    this.tracksLoaded = false;
};

MidiManager.prototype.getInstruments = function() {
    return this.instruments;
};

MidiManager.prototype.init = function(userId) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.setupNotes();
    var _this = this;
    this.loadSoundfonts(function() {
        _this.loadAudiofiles(function() {
            _this.play("audio/MIDIMaster.mid", userId);
        })
    })
};

MidiManager.prototype.setupNotes = function() {
    var A0 = 0x15; // first note
    var C8 = 0x6C; // last note
    var number2key = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (var n = A0; n <= C8; n++) {
        var octave = (n - 12) / 12 >> 0;
        var name = number2key[n % 12] + octave;
        this.keyToNote[name] = n;
    }
};

MidiManager.prototype.loadSoundfonts = function(onLoaded) {
    var numRequests = this.instruments.length;
    var filesLoaded = 0;
    for(var i=0; i<numRequests; ++i) {
        loadRequest(this.soundFontURL, this.instruments[i], function() {
            //DEBUG
            console.log("Soundfont ", filesLoaded+1, " loaded");
            if(++filesLoaded === numRequests) {
                //DEBUG
                console.log("All soundfonts loaded");
                onLoaded();
            }
        })
    }
};

MidiManager.prototype.loadAudiofiles = function(onLoaded) {
    var numRequests = this.instruments.length;
    var filesLoaded = 0;
    for(var i=0; i<this.instruments.length; ++i) {
        loadAudioFiles(this.audioContext, this.keyToNote, this.instruments[i], i, this.audioBuffers, function() {
            //DEBUG
            console.log("File loaded");
            if(++filesLoaded === numRequests) {
                //DEBUG
                console.log("All files loaded");
                onLoaded();
            }
        })
    }
};

MidiManager.prototype.loadRemoteFile = function(path, callback) {
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
};

MidiManager.prototype.play = function(midiFilename, userId) {
    //Play the file
    var _this = this;
    this.loadRemoteFile(midiFilename, function(data) {
        $('#loadIndicator').html("Loaded");
        this.midiFile = MidiFile(data);
        this.synth = Synth(this.SAMPLERATE);
        _this.replayer = Replayer(this.midiFile, this.synth, _this.audioBuffers);
        var midiData = _this.replayer.getData();
        _this.tracksLoaded = true;
        _this.replayer.setTrackMapping(1, 0);
        _this.replayer.setTrackMapping(2, 1);
        _this.replayer.setTrackMapping(3, 2);
        _this.replayer.setTrackMapping(4, 3);
        _this.replayer.setTrackMapping(5, 4);
        _this.replayer.setTrackMapping(6, 5);
        _this.audio = AudioPlayer(_this.replayer, midiData, userId);
    })
};

MidiManager.prototype.muteTrack = function(trackNumber, muteStatus) {
    this.replayer.setMuteTrack(trackNumber, muteStatus);
};

MidiManager.prototype.muteAllTracks = function() {
    this.replayer.muteAllTracks();
};

MidiManager.prototype.setTrackMapping = function(track, instrument) {
    this.replayer.setTrackMapping(track, instrument);
};

MidiManager.prototype.setTrackMappingId = function(track, instrumentId) {
    //Get instrument value from list
    var instrument = 0;
    for(var i=0;  i<this.instruments.length; ++i) {
        if(this.instruments[i] === instrumentId) {
            instrument = i;
            break;
        }
    }
    this.replayer.setTrackMapping(track, instrument);
};

MidiManager.prototype.allTracksLoaded = function() {
    return this.tracksLoaded;
};

MidiManager.prototype.setPlaybackRate = function(rate) {
    this.replayer.setPlaybackRate(rate);
};

MidiManager.prototype.setFilterFrequency = function(freq, gain) {
    if(freq === undefined) freq = 1000;
    if(gain === undefined) gain = 0;
    this.replayer.setFilterFrequency(freq, gain);
};

MidiManager.prototype.getPlaybackTime = function() {
    if(this.audio) {
        return this.audio.getCurrentPlaybackTime();
    } else {
        return undefined;
    }
};

MidiManager.prototype.setCurrentPlaybackTime = function(time) {
    if(this.audio) {
        this.audio.setCurrentPlaybackTime(time);
    }
};