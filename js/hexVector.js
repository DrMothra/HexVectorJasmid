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
                    $('#loaded').html("Loaded");
                    //Start playing
                    //this.replayer.muteAllTracks();
                    midiManager.play("audio/MIDIMaster.mid");
                });

            });
        },

        loadRemoteFile: function(path, callback) {
            var fetch = new XMLHttpRequest(); fetch.open('GET', path);
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
                this.audio = AudioPlayer(this.replayer, midiData);
            })
        },

        muteTrack: function(trackNumber, muteStatus) {
            _this.replayer.setMuteTrack(trackNumber, muteStatus);
        },

        muteAllTracks: function() {
            _this.replayer.muteAllTracks();
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

    var lineToTrack = [undefined, undefined, undefined, undefined, undefined, undefined];

    midiManager.init();

    //Graphics
    var game = new Phaser.Game(1280, 640, Phaser.AUTO, '', { preload: preload, create: create });
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
        {x: 600, y: 95, rot: 1.1, scale: 0.225},
        {x: 705, y: 145, rot: -0.63, scale: 0.375},
        {x: 655, y: 270, rot: 1.125, scale: 0.465},
        {x: 550, y: 220, rot: 0, scale: 0.4},
        {x: 655, y: 170, rot: -1.125, scale: 0.475},
        {x: 600, y: 195, rot: 0.375, scale: 0.55}
    ];
    var lineWidth = 3;
    var lineColour = 0x868686;
    var startX=550, startY=120;
    var originYOffset = 100;
    var circleSize = 10;
    var pyramidLines = [
        {x: 650, y: 70},
        {x: 760, y: 220},
        {x: 550, y: 320},
        {x: 550, y: 120},
        {x: 760, y: 220}
    ];

    var notes = ['explosion', 'sword', 'blaster', 'ping', 'menu', 'meow'];
    var numNotes = 6;
    var indent = 400;
    var noteLines = [];
    var fx = [];

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
            noteLines[i].scale.setTo(0.25, 0.25);
            //  Enable input and allow for dragging
            noteLines[i].inputEnabled = true;
            noteLines[i].input.enableDrag();
            noteLines[i].events.onDragStop.add(onDragStop, this);
        }

        for(i=0; i<notes.length; ++i) {
            fx.push(game.add.audio(notes[i]));
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
            line.x = shapeCentres[centrePoint].x;
            line.y = shapeCentres[centrePoint].y;
            line.rotation = shapeCentres[centrePoint].rot;
            line.scale.y = shapeCentres[centrePoint].scale;
            midiManager.muteTrack(centrePoint+1, false);
            lineToTrack[lineNumber] = centrePoint + 1;
            //DEBUG
            //console.log("Line ", lineNumber, " = track ", centrePoint+1);
        }
    }

    function resetLine(pointer, lineNumber) {
        var line = noteLines[lineNumber];

        line.x = (lineSpacing * (lineNumber+1)) + indent;
        line.y = game.world.height - originYOffset;
        line.scale.y = 0.25;
        line.rotation = 0;
        if(lineToTrack[lineNumber] !== undefined) {
            midiManager.muteTrack(lineToTrack[lineNumber], true);
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
