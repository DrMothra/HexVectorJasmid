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
    this.tracksLoaded = false;
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
            _this.play("audio/MIDIMasterv0.2.mid");
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
        _this.tracksLoaded = true;
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

MidiManager.prototype.allTracksLoaded = function() {
    return this.tracksLoaded;
};

var GraphicsEngine = function() {
    this.lineToTrack = [undefined, undefined, undefined, undefined, undefined, undefined];
    this.game = null
    this.lineSpacing = 64;
    this.shapeCentres = [
        {x: 400, y: 175, rot: 1.225, scale: 0.425},
        {x: 562.5, y: 257.5, rot: -0.5, scale: 0.53},
        {x: 462.5, y: 437.5, rot: 1.2, scale: 0.7},
        {x: 300, y: 355, rot: 0, scale: 0.575},
        {x: 462.5, y: 292.5, rot: -1.1, scale: 0.725},
        {x: 400, y: 320, rot: 0.5, scale: 0.85}
    ];
    this.lineWidth = 3;
    this.lineColour = 0x868686;
    this.startX=300;
    this.startY=210;
    this.originYOffset = 400;
    this.pyramidLines = [
        {x: this.startX, y: this.startY},
        {x: 500, y: 140},
        {x: 625, y: 375},
        {x: 300, y: 500},
        {x: 300, y: 210},
        {x: 625, y: 375}
    ];
    this.numNotes = 6;
    this.indent = 225;
    this.noteLines = [];
    this.endPoints = [];
    this.endPointsStart = [];
    this.trackOccupied = [];
    this.graphics = null;
    this.updateRequired = false;
};

GraphicsEngine.prototype.init = function() {
    var _this = this;
    this.game = new Phaser.Game(1024, 1360, Phaser.AUTO, '', { preload: _this.preload, create: _this.create, update: _this.update });
};

GraphicsEngine.prototype.preload = function() {
    this.game.load.image('vector', 'assets/vectorHex.png');
    this.game.load.image('endPoint', 'assets/whiteCircle.png');
};

GraphicsEngine.prototype.create = function() {
    //Draw background first
    var _this = this;
    var i=0;
    var numLines = this.pyramidLines.length;
    this.graphics = this.game.add.graphics(0, 0);

    // Draw pyramid
    this.drawPyramid();

    var musicGroup = this.game.add.group();
    musicGroup.add(this.graphics);

    musicGroup.getBounds();

    for(i=0; i<this.numNotes; ++i) {
        this.noteLines[i] = this.game.add.sprite((this.lineSpacing*(i+1)) + this.indent, this.game.world.height - this.originYOffset, 'vector');
        this.noteLines[i].lineNumber = i;
        this.noteLines[i].anchor.x = 0.5;
        this.noteLines[i].anchor.y = 0.5;
        this.noteLines[i].scale.setTo(0.25, 0.35);
        //  Enable input and allow for dragging
        this.noteLines[i].inputEnabled = true;
        this.noteLines[i].input.enableDrag();
        this.noteLines[i].events.onDragStop.add(onDragStop, this);
        this.trackOccupied[i] = false;
    }

    function onDragStop(sprite, pointer) {

        var lineBounds = sprite.getBounds();
        var rectBounds = musicGroup.getBounds();

        //console.log("Number =", sprite.lineNumber);

        if(Phaser.Rectangle.intersects(lineBounds, rectBounds)) {
            this.snapToLine(pointer, sprite.lineNumber);
        } else {
            this.resetLine(pointer, sprite.lineNumber);
        }

    }

    for(i=0; i<(numLines-2); ++i) {
        this.endPoints[i] = this.game.add.sprite(this.pyramidLines[i].x, this.pyramidLines[i].y, 'endPoint');
        this.endPoints[i].endPointId = i;
        this.endPoints[i].anchor.x = 0.5;
        this.endPoints[i].anchor.y = 0.5;
        this.endPoints[i].inputEnabled = true;
        this.endPoints[i].input.enableDrag();
        this.endPoints[i].events.onDragStart.add(endPointDragStart, this);
        this.endPoints[i].events.onDragUpdate.add(endPointDragUpdate, this);
        this.endPoints[i].events.onDragStop.add(endPointDragStop, this);
        this.endPoints[i].canDrag = false;
    }

    function endPointDragStart(endPoint, pointer) {
        var lineLength = endPoint.linesOccupied.length;
        var lineOccupied = false;
        for(var i=0; i<lineLength; ++i) {
            if(_this.trackOccupied[endPoint.linesOccupied[i]]) {
                lineOccupied = true;
                break;
            }
        }
        endPoint.canDrag = lineOccupied;
        //DEBUG
        console.log("Line occupied = ", lineOccupied);
    }

    function endPointDragUpdate(endPoint, pointer) {
        if(!endPoint.canDrag) {
            endPoint.x = _this.endPointsStart[endPoint.id].x;
            endPoint.y = _this.endPointsStart[endPoint.id].y;
            return;
        }

        var pointsLength = endPoint.movePoints.length;
        for(var i=0; i<pointsLength; ++i) {
            _this.pyramidLines[endPoint.movePoints[i]].x = pointer.x;
            _this.pyramidLines[endPoint.movePoints[i]].y = pointer.y;
        }
        _this.updateRequired = true;
    }

    function endPointDragStop(endPoint, pointer) {
        if(!endPoint.canDrag) return;
    }

    //Setup points influenced by moving other points
    this.endPoints[0].movePoints = [0, 4];
    this.endPoints[1].movePoints = [1];
    this.endPoints[2].movePoints = [2, 5];
    this.endPoints[3].movePoints = [3];

    //Can only move if pyramid has line on it
    this.endPoints[0].linesOccupied = [0, 3, 4];
    this.endPoints[1].linesOccupied = [0, 1, 5];
    this.endPoints[2].linesOccupied = [1, 2, 4];
    this.endPoints[3].linesOccupied = [2, 3, 4];

    //Need to keep record of start positions so we can reset
    var point;
    for(var i=0; i<this.endPoints.length; ++i) {
        point = {};
        point.x = this.endPoints[i].x;
        point.y = this.endPoints[i].y;
        this.endPointsStart.push(point);
    }
};

GraphicsEngine.prototype.update = function() {
    if(this.updateRequired) {
        this.graphics.clear();

        this.drawPyramid();
        this.updateRequired = false;
    }
};

GraphicsEngine.prototype.drawPyramid = function() {
    var numLines = this.pyramidLines.length;
    this.graphics.lineStyle(this.lineWidth, this.lineColour, 1);
    this.graphics.moveTo(this.pyramidLines[0].x, this.pyramidLines[0].y);
    for (var i = 1; i < numLines; ++i) {
        this.graphics.lineTo(this.pyramidLines[i].x, this.pyramidLines[i].y);
    }

    this.graphics.moveTo(this.pyramidLines[1].x, this.pyramidLines[1].y);
    this.graphics.lineTo(this.pyramidLines[3].x, this.pyramidLines[3].y);
};

GraphicsEngine.prototype.snapToLine = function(pointer, lineNumber) {
    var minDist = 1000000, centrePoint = undefined;
    var tempDist;
    var tempPoint = new Phaser.Point();
    for(var i=0; i<this.shapeCentres.length; ++i) {
        tempPoint.setTo(this.shapeCentres[i].x, this.shapeCentres[i].y);
        tempDist = Phaser.Point.distance(pointer, tempPoint);
        if(tempDist < minDist) {
            minDist = tempDist;
            centrePoint = i;
        }
    }

    //DEBUG
    //console.log("Centre point = ", centrePoint);
    var line = this.noteLines[lineNumber];
    if(centrePoint != undefined) {
        //Don't snap to existing line
        var trackNumber = this.lineToTrack[lineNumber];
        if(this.trackOccupied[centrePoint]) {
            if(trackNumber !== undefined) {
                centrePoint = trackNumber - 1;
                line.x = this.shapeCentres[centrePoint].x;
                line.y = this.shapeCentres[centrePoint].y;
                line.rotation = this.shapeCentres[centrePoint].rot;
                line.scale.y = this.shapeCentres[centrePoint].scale;
            } else {
                resetLine(pointer, lineNumber);
            }
            return;
        }

        //Did line come from existing track
        if(trackNumber !== undefined) {
            if(manager.allTracksLoaded()) {
                manager.muteTrack(trackNumber, true);
            }
            this.trackOccupied[trackNumber-1] = false;
        }
        line.x = this.shapeCentres[centrePoint].x;
        line.y = this.shapeCentres[centrePoint].y;
        line.rotation = this.shapeCentres[centrePoint].rot;
        line.scale.y = this.shapeCentres[centrePoint].scale;
        if(manager.allTracksLoaded()) {
            manager.muteTrack(centrePoint+1, false);
        }

        this.lineToTrack[lineNumber] = centrePoint + 1;
        this.trackOccupied[centrePoint] = true;
        //DEBUG
        console.log("Line ", lineNumber, " = track ", centrePoint+1);
    }
};

GraphicsEngine.prototype.resetLine = function(pointer, lineNumber) {
    var line = this.noteLines[lineNumber];

    line.x = (this.lineSpacing * (lineNumber+1)) + this.indent;
    line.y = this.game.world.height - this.originYOffset;
    line.scale.y = 0.35;
    line.rotation = 0;
    var trackNumber = this.lineToTrack[lineNumber];
    if(trackNumber !== undefined) {
        if(manager.allTracksLoaded()) {
            manager.muteTrack(trackNumber, true);
        }
        this.trackOccupied[trackNumber-1] = false;
        //DEBUG
        //console.log("Track ", lineToTrack[lineNumber], " muted");
    }
    this.lineToTrack[lineNumber] = undefined;
};

$(document).ready(function() {

    var manager = new MidiManager();
    manager.init();

    var engine = new GraphicsEngine();
    engine.init();

});
