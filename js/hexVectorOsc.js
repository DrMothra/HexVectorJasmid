/**
 * Created by DrTone on 02/02/2016.
 */

var webkitAudio = window.AudioContext || window.webkitAudioContext;
var audioContext = new webkitAudio();

var Note = function(attributes) {
    //Create new note with given attribute
    var modulatorFreq = 2.1, modulator1Gain = 1.5, modulator2Gain = 1.7;
    var currentFilterQ = 7, currentFilterCutoff = 256;
    var modFilterGain = 504;
    var currentEnvA = 2, currentEnvS = 68, currentEnvD = 15;
    var currentFilterEnv = 56, currentFilterEnvS = 5, currentFilterEnvA = 5, currentFilterEnvD = 6;
    // create osc 1
    this.osc1 = audioContext.createOscillator();
    this.osc1.frequency.value = attributes.frequency1;
    this.osc1.detune.value = attributes.detune1;
    this.osc1.type = 'sawtooth';

    this.osc1Gain = audioContext.createGain();
    this.osc1Gain.gain.value = attributes.gain1;
    this.osc1.connect( this.osc1Gain );

    // create osc 2
    this.osc2 = audioContext.createOscillator();
    this.osc2.frequency.value = attributes.frequency2;
    this.osc2.detune.value = attributes.detune2;
    this.osc2.type = 'sawtooth';

    this.osc2Gain = audioContext.createGain();
    this.osc2Gain.gain.value = 0.25;
    this.osc2.connect( this.osc2Gain );

    // create modulator osc
    this.modOsc = audioContext.createOscillator();
    this.modOsc.type = 'sine';
    this.modOsc.frequency.value = modulatorFreq;

    this.modOsc1Gain = audioContext.createGain();
    this.modOsc.connect( this.modOsc1Gain );
    this.modOsc1Gain.gain.value = modulator1Gain;
    this.modOsc1Gain.connect( this.osc1.frequency );	// tremolo

    this.modOsc2Gain = audioContext.createGain();
    this.modOsc.connect( this.modOsc2Gain );
    this.modOsc2Gain.gain.value = modulator2Gain;
    this.modOsc2Gain.connect( this.osc2.frequency );	// tremolo

    // create the LP filter
    this.filter1 = audioContext.createBiquadFilter();
    this.filter1.type = "lowpass";
    this.filter1.Q.value = currentFilterQ;
    this.filter1.frequency.value = currentFilterCutoff;
    this.filter2 = audioContext.createBiquadFilter();
    this.filter2.type = "lowpass";
    this.filter2.Q.value = currentFilterQ;
    this.filter2.frequency.value = currentFilterCutoff;

    this.osc1Gain.connect( this.filter1 );
    this.osc2Gain.connect( this.filter1 );
    this.filter1.connect( this.filter2 );

    // connect the modulator to the filters
    this.modFilterGain = audioContext.createGain();
    this.modOsc.connect( this.modFilterGain );
    this.modFilterGain.gain.value = modFilterGain;
    this.modFilterGain.connect( this.filter1.detune );	// filter tremolo
    this.modFilterGain.connect( this.filter2.detune );	// filter tremolo

    // create the volume envelope
    this.envelope = audioContext.createGain();
    this.filter2.connect( this.envelope );
    this.envelope.connect( attributes.effectChain );

    // set up the volume and filter envelopes
    var now = audioContext.currentTime;
    var envAttackEnd = now + (currentEnvA/20.0);

    this.envelope.gain.value = 0.0;
    this.envelope.gain.setValueAtTime( 0.0, now );
    this.envelope.gain.linearRampToValueAtTime( 1.0, envAttackEnd );
    this.envelope.gain.setTargetAtTime( (currentEnvS/100.0), envAttackEnd, (currentEnvD/100.0)+0.001 );

    var filterAttackLevel = currentFilterEnv*72;  // Range: 0-7200: 6-octave range
    var filterSustainLevel = filterAttackLevel* currentFilterEnvS / 100.0; // range: 0-7200
    var filterAttackEnd = (currentFilterEnvA/20.0);

    if (!filterAttackEnd)
        filterAttackEnd=0.05; // tweak to get target decay to work properly
    this.filter1.detune.setValueAtTime( 0, now );
    this.filter1.detune.linearRampToValueAtTime( filterAttackLevel, now+filterAttackEnd );
    this.filter2.detune.setValueAtTime( 0, now );
    this.filter2.detune.linearRampToValueAtTime( filterAttackLevel, now+filterAttackEnd );
    this.filter1.detune.setTargetAtTime( filterSustainLevel, now+filterAttackEnd, (currentFilterEnvD/100.0) );
    this.filter2.detune.setTargetAtTime( filterSustainLevel, now+filterAttackEnd, (currentFilterEnvD/100.0) );
};

Note.prototype.play = function() {
    this.osc1.start(0);
    this.osc2.start(0);
    this.modOsc.start(0);
};

Note.prototype.stop = function() {
    var currentEnvR = 5, currentFilterEnvR = 7;
    var now =  audioContext.currentTime;
    var release = now + (currentEnvR/10.0);

    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime( this.envelope.gain.value, now );  // this is necessary because of the linear ramp
    this.envelope.gain.setTargetAtTime(0.0, now, (currentEnvR/100));
    this.filter1.detune.cancelScheduledValues(now);
    this.filter1.detune.setTargetAtTime( 0, now, (currentFilterEnvR/100.0) );
    this.filter2.detune.cancelScheduledValues(now);
    this.filter2.detune.setTargetAtTime( 0, now, (currentFilterEnvR/100.0) );

    this.osc1.stop(release);
    this.osc2.stop(release);
};

//Oscillators for note generation
var oscillator = (function() {

    var effectChain = null;
    var waveshaper = null;
    var revNode = null, revGain, revBypassGain;
    var volNode;
    var compressor;
    var notes = [];
    var numNotes = 6;
    var noteAttributes = [];
    var osc1Freqs = [65, 87, 116.5, 155, 207.5, 247];
    var osc1Detunes = [0, 0, 0, 0, 0, 0];
    var osc2Freqs = [130, 174, 233, 310, 415, 494];
    var osc2Detunes = [-25, -25, -25, -25, -25, -25];
    var gain1Gain = 0.25, gain2Gain = 0.25;
    var modFilterGain;
    var envelope;
    var currentVol = 75;

    return {
        init: function() {
            effectChain = audioContext.createGain();
            waveshaper = new WaveShaper(audioContext);
            effectChain.connect(waveshaper.input);
            revNode = audioContext.createGain();

            revGain = audioContext.createGain();
            revBypassGain = audioContext.createGain();

            volNode = audioContext.createGain();
            volNode.gain.value = currentVol;
            compressor = audioContext.createDynamicsCompressor();
            waveshaper.output.connect(revNode);
            waveshaper.output.connect(revBypassGain);
            revNode.connect(revGain);
            revGain.connect(volNode);
            revBypassGain.connect(volNode);

            volNode.connect(compressor);
            compressor.connect(audioContext.destination);

            //Set up notes for lines
            var noteObj;
            for (var i = 0; i < numNotes; ++i) {
                noteObj = {};
                noteObj.frequency1 = osc1Freqs[i];
                noteObj.detune1 = osc1Detunes[i];
                noteObj.frequency2 = osc2Freqs[i];
                noteObj.detune2 = osc2Detunes[i];
                noteObj.gain1 = gain1Gain;
                noteObj.gain2 = gain2Gain;
                noteObj.effectChain = effectChain;
                noteAttributes.push(noteObj);
                notes.push(new Note(noteObj));
            }
        },

        play: function(note) {
            if(notes[note] === null) {
                notes[note] = new Note(noteAttributes[note]);
            }
            notes[note].play();
        },

        stop: function(note) {
            notes[note].stop();
            notes[note] = null;
        }
    }
})();

$('#document').ready(function() {

    var lineToTrack = [undefined, undefined, undefined, undefined, undefined, undefined];

    oscillator.init();

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
                    line.x = shapeCentres[trackNumber].x;
                    line.y = shapeCentres[trackNumber].y;
                    line.rotation = shapeCentres[trackNumber].rot;
                    line.scale.y = shapeCentres[trackNumber].scale;
                } else {
                    resetLine(pointer, lineNumber);
                }
                return;
            }

            //Did line come from existing track
            if(trackNumber !== undefined) {
                trackOccupied[trackNumber] = false;
                oscillator.stop(trackNumber);
            }

            line.x = shapeCentres[centrePoint].x;
            line.y = shapeCentres[centrePoint].y;
            line.rotation = shapeCentres[centrePoint].rot;
            line.scale.y = shapeCentres[centrePoint].scale;
            lineToTrack[lineNumber] = centrePoint;
            oscillator.play(centrePoint);
            trackOccupied[centrePoint] = true;

            //DEBUG
            console.log("Line ", lineNumber, " = centre ", centrePoint);
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
            oscillator.stop(lineToTrack[lineNumber]);
            trackOccupied[trackNumber] = false;
            //DEBUG
            console.log("Centre ", lineToTrack[lineNumber], " clear");
        }

        //console.log("Stopped");
        lineToTrack[lineNumber] = undefined;
    }

    function checkOverlap(sprite) {
        var bounds = sprite.getBounds();
        var boundsB = musicGroup.getBounds();

        return Phaser.Rectangle.intersects(bounds, boundsB);
    }


});
