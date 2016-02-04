/**
 * Created by DrTone on 29/01/2016.
 */
var MidiManager = function() {
    this.replayer = null;
    this.midiFile = null;
    this.SAMPLERATE = 44100;
    this.soundFontURL = "./soundfont/";
    this.instruments = ['acoustic_grand_piano', 'synth_drum', 'electric_grand_piano', 'lead_2_sawtooth', 'marimba',
                            'pad_3_polysynth', 'string_ensemble_1', 'synth_strings_1'];
    this.audioContext = null;
    this.audioBuffers = {};
    this.keyToNote = {};
};

MidiManager.prototype.getInstruments = function() {
    return this.instruments;
};

MidiManager.prototype.init = function() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.setupNotes();
    var _this = this;
    this.loadSoundfonts(function() {
        _this.loadAudiofiles(function() {
            _this.play("audio/MIDIMaster.mid");
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
            console.log("File loaded");
            if(++filesLoaded === numRequests) {
                //DEBUG
                console.log("All files loaded");
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

MidiManager.prototype.play = function(midiFilename) {
    //Play the file
    var _this = this;
    this.loadRemoteFile(midiFilename, function(data) {
        $('#loadIndicator').html("Loaded");
        this.midiFile = MidiFile(data);
        this.synth = Synth(this.SAMPLERATE);
        _this.replayer = Replayer(this.midiFile, this.synth, _this.audioBuffers);
        var midiData = _this.replayer.getData();
        this.audio = AudioPlayer(_this.replayer, midiData);
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

$(document).ready(function() {

    var lineToTrack = [undefined, undefined, undefined, undefined, undefined, undefined];

    var manager = new MidiManager();
    manager.init();

    var numTracks = 6;
    var options = manager.getInstruments();
    var sel;
    for(var track=1; track<=numTracks; ++track) {
        sel = document.getElementById('selectTrack'+track);
        var option;
        for(var i=0; i<options.length; ++i) {
            option = document.createElement('option');
            option.innerHTML = options[i];
            option.value = options[i];
            sel.appendChild(option);
        }
    }

    $('select[id^="selectTrack"]').on('change', function() {
        var track = this.id.charAt(this.id.length-1);
        manager.setTrackMappingId(track, this.value);
    });

    //Graphics
    var game = new Phaser.Game(1024, 1360, Phaser.AUTO, '', { preload: preload, create: create });
    var player;
    var lineSpacing = 64;
    function preload() {

        game.load.image('vector', 'assets/vectorHex.png');
        /*
         MIDI.Player.addListener(function(data) {
         console.log("Channel = ", data.channel);
         })
         */
    }

    var result;
    var musicSquare, musicGroup;
    var shapes = [
        {x: 250, y: 110, width: 150, height: 150}
    ];
    var shapeCentres = [
        {x: 400, y: 175, rot: 1.225, scale: 0.425},
        {x: 562.5, y: 257.5, rot: -0.5, scale: 0.53},
        {x: 462.5, y: 437.5, rot: 1.2, scale: 0.7},
        {x: 300, y: 355, rot: 0, scale: 0.575},
        {x: 462.5, y: 292.5, rot: -1.1, scale: 0.725},
        {x: 400, y: 320, rot: 0.5, scale: 0.85}
    ];
    var lineWidth = 3;
    var lineColour = 0x868686;
    var startX=300, startY=210;
    var originYOffset = 400;
    var circleSize = 10;
    var pyramidLines = [
        {x: 500, y: 140},
        {x: 625, y: 375},
        {x: 300, y: 500},
        {x: 300, y: 210},
        {x: 625, y: 375}
    ];

    var notes = ['explosion', 'sword', 'blaster', 'ping', 'menu', 'meow'];
    var numNotes = 6;
    var indent = 225;
    var noteLines = [];
    var trackOccupied = [];

    function create() {

        var i=0;
        var numLines = pyramidLines.length;
        var graphics = game.add.graphics(0, 0);

        // set a line style
        graphics.lineStyle(lineWidth, lineColour, 1);
        graphics.moveTo(startX, startY);
        for(i=0; i<numLines; ++i) {
            graphics.lineTo(pyramidLines[i].x, pyramidLines[i].y);
        }

        graphics.moveTo(pyramidLines[0].x, pyramidLines[0].y);
        graphics.lineTo(pyramidLines[2].x, pyramidLines[2].y);

        graphics.lineStyle(lineWidth, 0xffffff, 1);
        graphics.beginFill(0xffffff);
        for(i=0; i<(numLines-1); ++i) {
            graphics.drawCircle(pyramidLines[i].x, pyramidLines[i].y, circleSize);
        }
        graphics.endFill();

        musicGroup = game.add.group();
        musicGroup.add(graphics);

        musicGroup.getBounds();

        for(i=0; i<numNotes; ++i) {
            noteLines[i] = game.add.sprite((lineSpacing*(i+1)) + indent, game.world.height - originYOffset, 'vector');
            noteLines[i].lineNumber = i;
            noteLines[i].anchor.x = 0.5;
            noteLines[i].anchor.y = 0.5;
            noteLines[i].scale.setTo(0.25, 0.35);
            //  Enable input and allow for dragging
            noteLines[i].inputEnabled = true;
            noteLines[i].input.enableDrag();
            noteLines[i].events.onDragStop.add(onDragStop, this);
            trackOccupied[i] = false;
        }


        //  Being mp3 files these take time to decode, so we can't play them instantly
        //  Using setDecodedCallback we can be notified when they're ALL ready for use.
        //  The audio files could decode in ANY order, we can never be sure which it'll be.

        //game.sound.setDecodedCallback(fx, start, this);
    }

    function onDragStop(sprite, pointer) {

        var lineBounds = sprite.getBounds();
        var rectBounds = musicGroup.getBounds();

        //console.log("Number =", sprite.lineNumber);

        if(Phaser.Rectangle.intersects(lineBounds, rectBounds)) {
            snapToLine(pointer, sprite.lineNumber);
        } else {
            resetLine(pointer, sprite.lineNumber);
        }

    }

    function snapToLine(pointer, lineNumber) {

        var minDist = 1000000, centrePoint = undefined;
        var tempDist;
        var tempPoint = new Phaser.Point();
        for(var i=0; i<shapeCentres.length; ++i) {
            tempPoint.setTo(shapeCentres[i].x, shapeCentres[i].y);
            tempDist = Phaser.Point.distance(pointer, tempPoint);
            if(tempDist < minDist) {
                minDist = tempDist;
                centrePoint = i;
            }
        }

        //DEBUG
        //console.log("Centre point = ", centrePoint);
        var line = noteLines[lineNumber];
        if(centrePoint != undefined) {
            //Don't snap to existing line
            var trackNumber = lineToTrack[lineNumber];
            if(trackOccupied[centrePoint]) {
                if(trackNumber !== undefined) {
                    centrePoint = trackNumber - 1;
                    line.x = shapeCentres[centrePoint].x;
                    line.y = shapeCentres[centrePoint].y;
                    line.rotation = shapeCentres[centrePoint].rot;
                    line.scale.y = shapeCentres[centrePoint].scale;
                } else {
                    resetLine(pointer, lineNumber);
                }
                return;
            }

            //Did line come from existing track
            if(trackNumber !== undefined) {
                manager.muteTrack(trackNumber, true);
                trackOccupied[trackNumber-1] = false;
            }
            line.x = shapeCentres[centrePoint].x;
            line.y = shapeCentres[centrePoint].y;
            line.rotation = shapeCentres[centrePoint].rot;
            line.scale.y = shapeCentres[centrePoint].scale;
            manager.muteTrack(centrePoint+1, false);

            lineToTrack[lineNumber] = centrePoint + 1;
            trackOccupied[centrePoint] = true;
            //DEBUG
            console.log("Line ", lineNumber, " = track ", centrePoint+1);
        }
    }

    function resetLine(pointer, lineNumber) {
        var line = noteLines[lineNumber];

        line.x = (lineSpacing * (lineNumber+1)) + indent;
        line.y = game.world.height - originYOffset;
        line.scale.y = 0.35;
        line.rotation = 0;
        var trackNumber = lineToTrack[lineNumber];
        if(trackNumber !== undefined) {
            manager.muteTrack(trackNumber, true);
            trackOccupied[trackNumber-1] = false;
            //DEBUG
            //console.log("Track ", lineToTrack[lineNumber], " muted");
        }
        lineToTrack[lineNumber] = undefined;
    }

    function checkOverlap(sprite) {
        var bounds = sprite.getBounds();
        var boundsB = musicGroup.getBounds();

        return Phaser.Rectangle.intersects(bounds, boundsB);
    }

    $('#play').on("click", function() {
        midiManager.play("audio/MIDIMaster.mid");
    });

    var muteTrack = false;
    $('#mute').on("click", function() {
        muteTrack = !muteTrack;
        midiManager.muteTrack(6, muteTrack);
        //midiManager.muteTrack(5, muteTrack);
        //midiManager.muteTrack(4, muteTrack);
    })
});
