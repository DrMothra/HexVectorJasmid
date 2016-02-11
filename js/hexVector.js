/**
 * Created by DrTone on 29/01/2016.
 */
var STARTING = 0, PLAYING = 1, TIMED_OUT = 2;
var screenManager = (function() {
    var status;
    var continueTime = 10 * 1000;
    var countdownTime = 1000;
    var playingTime = 180 * 1000;
    var waitingTimer, countdownTimer, playingTimer;
    var touched = false;

    return {
        init: function() {
            status = STARTING;
        },

        setStatus: function(state) {
            status = state;
        },

        getStatus: function() {
            return status;
        },

        touched: function() {
            touched = true;
        },

        startWaiting: function() {
            //DEBUG
            console.log("Started waiting...");

            waitingTimer = setInterval(function () {
                if (!touched) {
                    $('#continue').show();
                    clearInterval(waitingTimer);
                    screenManager.startCountdown();
                } else {
                    touched = false;
                }
            }, continueTime);
        },

        startPlaying: function() {
            //DEBUG
            console.log("Started playing");

            playingTimer = setInterval(function() {
                //DEBUG
                console.log("Play timeout");
                $('#timeUpContainer').show();
                status = TIMED_OUT;
                screenManager.stopTimers();
            }, playingTime);
        },

        startCountdown: function() {
            var countdown = 5;
            var elem = $('#countdown');
            elem.show();
            $('#continue').show();
            elem.html(countdown.toString());
            countdownTimer = setInterval(function() {
                //Update clock
                --countdown;
                elem.html(countdown.toString());
                if(touched) {
                    //Stop countdown
                    clearInterval(countdownTimer);
                    elem.hide();
                    $('#continue').hide();
                    touched = false;
                    screenManager.startWaiting();
                }
                if(countdown <= 0) {
                    clearInterval(countdownTimer);
                    $('#continue').hide();
                    var event = new Event("reset");
                    document.getElementById('playArea').dispatchEvent(event);
                    status = STARTING;
                }
            }, countdownTime);
        },

        stopTimers: function() {
            clearInterval(waitingTimer);
            clearInterval(countdownTimer);
            clearInterval(playingTimer);
        },

        launchIntoFullscreen: function(element) {
            if(element.requestFullscreen) {
                element.requestFullscreen();
            } else if(element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if(element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if(element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
        },

        isFullScreen: function() {
            return (document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement);
        }
    }
})();

$(document).ready(function() {
    //Get id
    var synced = false;
    var userId = localStorage.getItem("tabletId");
    //DEBUG
    console.log("User = ", userId);
    screenManager.init();

    var manager = new MidiManager();
    manager.init(userId, dataLoaded);

    var wsUrl = "ws://192.168.0.14";
    var wsPort = 8887;
    var syncIndex, syncStr = 'Sync', syncTime;
    connectionManager.init(userId);
    connectionManager.connect(wsUrl, wsPort, function(data) {
        //See if sync message
        if(synced) return;
        syncIndex = data.indexOf(syncStr);
        if(syncIndex !== -1) {
            data = data.substr(syncStr.length, data.length);
            syncTime = parseInt(data);
            if(isNaN(syncTime)) {
                //DEBUG
                console.log("Bad sync time!");
            } else {
                //DEBUG
                console.log("Sync time = ", syncTime);
                manager.setCurrentPlaybackTime(syncTime);
                //synced = true;
                //DEBUG
                //$('#debug').html(syncTime.toString());
            }
        }
    });

    //DEBUG
    console.log("Stored id ", userId);
    //$('#debug').html(userId);

    if(userId === undefined) {
        //Cannot really carry on without user id
        alert("No user id set!");
        return;
    }

    //Broadcast time sync
    if(userId.indexOf("server") !== -1) {
        //This is server - broadcast sync
        syncTime = 10 * 1000;
        var timeSyncTimer = setInterval(function() {
            //DEBUG
            //console.log("Sent sync");
            var time = manager.getPlaybackTime().toString();
            if(time !== undefined) {
                connectionManager.sendMessage("Sync" + time);
            }
            //$('#debug').html(time);
        }, syncTime);
    }

    var game = new Phaser.Game(800, 1280, Phaser.AUTO, 'playArea');

    var allLoaded = false;
    function dataLoaded() {
        //DEBUG
        console.log("Data loaded");

        $('#progress').hide();
        allLoaded = true;
    }

    $('#logo').on("click", function() {
        //Full screen
        if(screenManager.isFullScreen()) {
            if(allLoaded) {
                $('#logo').hide();
                $('#progress').hide();
                $('#playArea').show();
                $('#resetContainer').show();
                screenManager.setStatus(PLAYING);
                screenManager.startWaiting();
                screenManager.startPlaying();
            }
        } else {
            screenManager.launchIntoFullscreen(document.documentElement); // the whole page
        }
    });

    $('#resetContainer').on("click", function() {
        resetApp();
    });

    document.getElementById('playArea').addEventListener("reset", function() {
        //DEBUG
        console.log("Received reset");
        resetApp();
    }, false);

    function resetApp() {
        screenManager.stopTimers();
        game.state.states['Pyramid'].resetAll();
        screenManager.setStatus(STARTING);
        $('#logo').show();
        $('#playArea').hide();
        $('#resetContainer').hide();
        $('#timeUpContainer').hide();
    }

    var Pyramid = {
        preload: function() {
            game.load.image('vector', 'assets/vectorHex.png');
            game.load.image('endPoint', 'assets/whiteCircle.png');
        },

        create: function() {
            //Draw background first
            var i;
            var numNotes = 6;
            this.lineSpacing = 64;
            this.indent = 175;
            this.originYOffset = 200;
            this.updateRequired = false;
            this.pyramidToTrack = [undefined, undefined, undefined, undefined, undefined, undefined];
            this.reset = true;
            this.lineLength = 484;
            this.pyramidStartLines = [];
            this.pyramidLines = [
                {x: 230, y: 310},
                {x: 430, y: 240},
                {x: 555, y: 475},
                {x: 230, y: 600},
                {x: 230, y: 310},
                {x: 555, y: 475}
            ];
            var lineSegment;
            for(i=0; i<this.pyramidLines.length; ++i) {
                lineSegment = {};
                lineSegment.x = this.pyramidLines[i].x;
                lineSegment.y = this.pyramidLines[i].y;
                this.pyramidStartLines.push(lineSegment);
            }

            this.noteLines = [];
            this.endPoints = [];
            this.endPointsStart = [];
            this.trackOccupied = [];
            this.shapeCentres = [];

            this.base = game.add.graphics(0,0);
            this.drawBase();

            this.calculateLineProperties();

            this.graphics = game.add.graphics(0, 0);

            //Background elements first
            // Draw pyramid
            this.lineWidth = 3;
            this.lineColour = 0x868686;
            this.drawPyramid();

            this.musicGroup = game.add.group();
            this.musicGroup.add(this.graphics);

            this.musicGroup.getBounds();

            //Lines that trigger tracks
            this.lineXScale = 0.25, this.lineYScale = 0.4;
            for(i=0; i<numNotes; ++i) {
                this.noteLines.push(game.add.sprite((this.lineSpacing*(i+1)) + this.indent, game.world.height - this.originYOffset, 'vector'));
                this.noteLines[i].lineNumber = i;
                this.noteLines[i].anchor.x = 0.5;
                this.noteLines[i].anchor.y = 0.5;
                this.noteLines[i].scale.setTo(this.lineXScale, this.lineYScale);
                //  Enable input and allow for dragging
                this.noteLines[i].inputEnabled = true;
                this.noteLines[i].input.enableDrag();
                this.noteLines[i].events.onDragStop.add(this.onDragStop, this);
                this.trackOccupied.push(false);
            }

            //Endpoints to grab
            var numLines = this.pyramidLines.length;
            for(i=0; i<(numLines-2); ++i) {
                this.endPoints.push(game.add.sprite(this.pyramidLines[i].x, this.pyramidLines[i].y, 'endPoint'));
                this.endPoints[i].id = i;
                this.endPoints[i].anchor.x = 0.5;
                this.endPoints[i].anchor.y = 0.5;
                this.endPoints[i].inputEnabled = true;
                this.endPoints[i].input.enableDrag();
                this.endPoints[i].events.onDragStart.add(this.endPointDragStart, this);
                this.endPoints[i].events.onDragUpdate.add(this.endPointDragUpdate, this);
                this.endPoints[i].events.onDragStop.add(this.endPointDragStop, this);
                this.endPoints[i].canDrag = false;
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
            this.endPoints[3].linesOccupied = [2, 3, 5];

            //Need to keep record of start positions so we can reset
            var point;
            for(i=0; i<this.endPoints.length; ++i) {
                point = {};
                point.x = this.endPoints[i].x;
                point.y = this.endPoints[i].y;
                this.endPointsStart.push(point);
            }

            //Update screen manager
            game.input.onDown.add(function() {
                screenManager.touched();
            }, this);
        },

        update: function() {
            if(this.updateRequired) {
                this.graphics.clear();

                this.drawPyramid();
                this.updateRequired = false;
                this.reset = false;
            }
        },

        drawBase: function() {
            this.base.lineStyle(0);
            this.base.beginFill(0x404040, 1.0);
            this.base.drawRect(0, 900, 800, 400);
            this.base.endFill();
        },

        drawPyramid: function() {
            var i;
            if(this.reset) {
                var lineNumber;
                for(i=0; i<this.pyramidLines.length; ++i) {
                    this.pyramidLines[i].x = this.pyramidStartLines[i].x;
                    this.pyramidLines[i].y = this.pyramidStartLines[i].y;
                }
                for(i=0; i<this.endPoints.length; ++i) {
                    this.endPoints[i].x = this.endPointsStart[i].x;
                    this.endPoints[i].y = this.endPointsStart[i].y;
                }
                for(i=0; i<this.trackOccupied.length; ++i) {
                    if(this.trackOccupied[i]) {
                        //Get line from track
                        lineNumber = this.pyramidToTrack[i];
                        --lineNumber;
                        this.noteLines[lineNumber].position.setTo(this.shapeCentres[i].x, this.shapeCentres[i].y);
                        this.noteLines[lineNumber].scale.setTo(this.lineXScale, this.shapeCentres[i].scale);
                        this.noteLines[lineNumber].rotation = this.shapeCentres[i].rot;
                    }
                }
            }
            var numLines = this.pyramidLines.length;
            this.graphics.lineStyle(this.lineWidth, this.lineColour, 1);
            this.graphics.moveTo(this.pyramidLines[0].x, this.pyramidLines[0].y);
            for (i = 1; i < numLines; ++i) {
                this.graphics.lineTo(this.pyramidLines[i].x, this.pyramidLines[i].y);
            }

            this.graphics.moveTo(this.pyramidLines[1].x, this.pyramidLines[1].y);
            this.graphics.lineTo(this.pyramidLines[3].x, this.pyramidLines[3].y);
        },

        calculateLineProperties: function() {
            //Centre points
            var i;
            var centreX, centreY, centreObj;
            for(i=0; i<this.pyramidLines.length-1; ++i) {
                centreObj = {};
                centreX = Math.abs(this.pyramidLines[i].x - this.pyramidLines[i+1].x)/2;
                centreX += this.pyramidLines[i].x < this.pyramidLines[i+1].x ? this.pyramidLines[i].x : this.pyramidLines[i+1].x;
                centreY = Math.abs(this.pyramidLines[i].y - this.pyramidLines[i+1].y)/2;
                centreY += this.pyramidLines[i].y < this.pyramidLines[i+1].y ? this.pyramidLines[i].y : this.pyramidLines[i+1].y;
                centreObj.x = centreX;
                centreObj.y = centreY;
                this.shapeCentres.push(centreObj);
            }
            //Last 2 centres between point 1 and 3
            centreObj = {};
            centreX = Math.abs(this.pyramidLines[1].x - this.pyramidLines[3].x)/2;
            centreX += this.pyramidLines[1].x < this.pyramidLines[3].x ? this.pyramidLines[1].x : this.pyramidLines[3].x;
            centreY = Math.abs(this.pyramidLines[1].y - this.pyramidLines[3].y)/2;
            centreY += this.pyramidLines[1].y < this.pyramidLines[3].y ? this.pyramidLines[1].y : this.pyramidLines[3].y;
            centreObj.x = centreX;
            centreObj.y = centreY;
            this.shapeCentres.push(centreObj);

            //Rotations
            var rot, dist;
            var point1 = new Phaser.Point();
            var point2 = new Phaser.Point();
            for(i=0; i<this.pyramidLines.length-1; ++i) {
                point1.x = this.pyramidLines[i].x;
                point1.y = this.pyramidLines[i].y;
                point2.x = this.pyramidLines[i+1].x;
                point2.y = this.pyramidLines[i+1].y;
                rot = game.math.angleBetweenPoints(point1, point2) + (Math.PI/2);
                this.shapeCentres[i].rot = rot;
                dist = Phaser.Point.distance(point1, point2);
                this.shapeCentres[i].scale = dist/this.lineLength;
            }
            //Last rotation between point 1 and 3
            point1.x = this.pyramidLines[1].x;
            point1.y = this.pyramidLines[1].y;
            point2.x = this.pyramidLines[3].x;
            point2.y = this.pyramidLines[3].y;
            rot = game.math.angleBetweenPoints(point1, point2) + (Math.PI/2);
            this.shapeCentres[i].rot = rot;
            dist = Phaser.Point.distance(point1, point2);
            this.shapeCentres[i].scale = dist/this.lineLength;
        },

        updateLineProperties: function() {
            var rot, dist, centreX, centreY;
            var point1 = new Phaser.Point();
            var point2 = new Phaser.Point();
            var lineNumber;
            for(var i=0; i<this.trackOccupied.length-1; ++i) {
                if(this.trackOccupied[i]) {
                    //Get line from track
                    lineNumber = this.pyramidToTrack[i];
                    --lineNumber;
                    centreX = Math.abs(this.pyramidLines[i].x - this.pyramidLines[i+1].x)/2;
                    centreX += this.pyramidLines[i].x < this.pyramidLines[i+1].x ? this.pyramidLines[i].x : this.pyramidLines[i+1].x;
                    centreY = Math.abs(this.pyramidLines[i].y - this.pyramidLines[i+1].y)/2;
                    centreY += this.pyramidLines[i].y < this.pyramidLines[i+1].y ? this.pyramidLines[i].y : this.pyramidLines[i+1].y;
                    this.noteLines[lineNumber].position.setTo(centreX, centreY);
                    point1.x = this.pyramidLines[i].x;
                    point1.y = this.pyramidLines[i].y;
                    point2.x = this.pyramidLines[i+1].x;
                    point2.y = this.pyramidLines[i+1].y;
                    rot = game.math.angleBetweenPoints(point1, point2) + (Math.PI/2);
                    //DEBUG
                    //console.log("Line = ", lineNumber);
                    this.noteLines[lineNumber].rotation = rot;
                    dist = Phaser.Point.distance(point1, point2);
                    this.noteLines[lineNumber].scale.setTo(this.lineXScale, dist/this.lineLength);
                }
            }
            if(this.trackOccupied[5]) {
                //Get line from track
                lineNumber = this.pyramidToTrack[i];
                --lineNumber;
                centreX = Math.abs(this.pyramidLines[1].x - this.pyramidLines[3].x)/2;
                centreX += this.pyramidLines[1].x < this.pyramidLines[3].x ? this.pyramidLines[1].x : this.pyramidLines[3].x;
                centreY = Math.abs(this.pyramidLines[1].y - this.pyramidLines[3].y)/2;
                centreY += this.pyramidLines[1].y < this.pyramidLines[3].y ? this.pyramidLines[1].y : this.pyramidLines[3].y;
                this.noteLines[lineNumber].position.setTo(centreX, centreY);
                point1.x = this.pyramidLines[1].x;
                point1.y = this.pyramidLines[1].y;
                point2.x = this.pyramidLines[3].x;
                point2.y = this.pyramidLines[3].y;
                rot = game.math.angleBetweenPoints(point1, point2) + (Math.PI/2);
                this.noteLines[lineNumber].rotation = rot;
                dist = Phaser.Point.distance(point1, point2);
                this.noteLines[lineNumber].scale.setTo(this.lineXScale, dist/this.lineLength);
            }
        },

        onDragStop: function(noteLine, pointer) {
            var lineBounds = noteLine.getBounds();
            var rectBounds = this.musicGroup.getBounds();

            //console.log("Number =", sprite.lineNumber);

            if(Phaser.Rectangle.intersects(lineBounds, rectBounds)) {
                this.snapToLine(pointer, noteLine.lineNumber);
            } else {
                this.resetLine(pointer, noteLine.lineNumber, undefined);
            }
        },

        endPointDragStart: function(endPoint, pointer) {
            var lineLength = endPoint.linesOccupied.length;
            var lineOccupied = false;
            for(var i=0; i<lineLength; ++i) {
                if(this.trackOccupied[endPoint.linesOccupied[i]]) {
                    lineOccupied = true;
                    break;
                }
            }
            endPoint.canDrag = lineOccupied;
            //DEBUG
            console.log("Line occupied = ", lineOccupied);
        },

        endPointDragUpdate: function(endPoint, pointer) {
            if(!endPoint.canDrag) {
                endPoint.x = this.endPointsStart[endPoint.id].x;
                endPoint.y = this.endPointsStart[endPoint.id].y;
                return;
            }

            var pointsLength = endPoint.movePoints.length;
            var pointToMove;
            for(var i=0; i<pointsLength; ++i) {
                pointToMove = endPoint.movePoints[0];
                this.pyramidLines[endPoint.movePoints[i]].x = pointer.x;
                this.pyramidLines[endPoint.movePoints[i]].y = pointer.y;
                this.updateLineProperties();
            }
            var delta = pointer.x - this.endPointsStart[pointToMove].x;

            if(delta > 0) {
                delta /= 150;
                delta += 1;
                if(delta > 2) delta = 2;
            } else {
                if(delta < -150) delta = -150;
                delta /= 150;
                delta += 1;
                if(delta < 0.25) delta = 0.25;
            }
            //DEBUG
            console.log("Delta = ", delta);

            var deltaY = pointer.y - this.endPointsStart[pointToMove].y;

            if(deltaY < 0) {
                deltaY = ((deltaY * 6000/200) * -1) + 1000;
                if(deltaY > 7000) deltaY = 7000;
            } else {
                deltaY = 1000 - (deltaY * 820/200);
                if(deltaY < 180) deltaY = 180;
            }
            //DEBUG
            //console.log("Delta = ", deltaY);

            manager.setPlaybackRate(delta);
            manager.setFilterFrequency(deltaY, 15);
            this.updateRequired = true;
        },

        endPointDragStop: function(endPoint, pointer) {
            //Restore everything
            this.reset = true;
            this.updateRequired = true;
            manager.setPlaybackRate(1);
            manager.setFilterFrequency(1000, 0);
        },

        snapToLine: function(pointer, lineNumber) {
            var minDist = 1000000, centrePoint = undefined;
            var tempDist, i;
            var tempPoint = new Phaser.Point();
            for(i=0; i<this.shapeCentres.length; ++i) {
                tempPoint.setTo(this.shapeCentres[i].x, this.shapeCentres[i].y);
                tempDist = Phaser.Point.distance(pointer, tempPoint);
                if(tempDist < minDist) {
                    minDist = tempDist;
                    centrePoint = i;
                }
            }

            var line = this.noteLines[lineNumber];
            if (centrePoint != undefined) {
                //Don't snap to existing line
                var previousCentre = undefined;
                for(i=0; i<this.pyramidToTrack.length; ++i) {
                    if(this.pyramidToTrack[i] === lineNumber+1) {
                        previousCentre = i;
                        //DEBUG
                        console.log("Previous centre = ", previousCentre);
                        break;
                    }
                }
                //DEBUG
                if(previousCentre === undefined) {
                    console.log("No previous centre");
                }

                if(this.trackOccupied[centrePoint]) {
                    if(previousCentre !== undefined) {
                        line.x = this.shapeCentres[previousCentre].x;
                        line.y = this.shapeCentres[previousCentre].y;
                        line.rotation = this.shapeCentres[previousCentre].rot;
                        line.scale.y = this.shapeCentres[previousCentre].scale;
                    } else {
                        this.resetLine(pointer, lineNumber);
                    }
                    return;
                }

                if(previousCentre !== undefined) {
                    if(manager.allTracksLoaded()) {
                        manager.muteTrack(this.pyramidToTrack[previousCentre], true);
                    }
                    this.trackOccupied[previousCentre] = false;
                    this.pyramidToTrack[previousCentre] = undefined;
                    //DEBUG
                    //console.log("Pyramid ", centrePoint, " Track ", trackNumber);
                }
                line.x = this.shapeCentres[centrePoint].x;
                line.y = this.shapeCentres[centrePoint].y;
                line.rotation = this.shapeCentres[centrePoint].rot;
                line.scale.y = this.shapeCentres[centrePoint].scale;
                if(manager.allTracksLoaded()) {
                    manager.muteTrack(lineNumber+1, false);
                }

                this.pyramidToTrack[centrePoint] = lineNumber + 1;
                this.trackOccupied[centrePoint] = true;
                //DEBUG
                console.log("Pyramid ", centrePoint, " = track ", lineNumber+1);
            }
        },

        resetLine: function(pointer, lineNumber) {
            var line = this.noteLines[lineNumber];

            line.x = (this.lineSpacing * (lineNumber+1)) + this.indent;
            line.y = game.world.height - this.originYOffset;
            line.scale.y = this.lineYScale;
            line.rotation = 0;

            //Was this track on a pyramid line
            var centrePoint = undefined;
            for(var i=0; i<this.pyramidToTrack.length; ++i) {
                if(this.pyramidToTrack[i] === lineNumber + 1) {
                    centrePoint = i;
                }
            }
            if(centrePoint !== undefined) {
                if(manager.allTracksLoaded()) {
                    manager.muteTrack(lineNumber+1, true);
                }
                this.trackOccupied[centrePoint] = false;
                this.pyramidToTrack[centrePoint] = undefined;
                //DEBUG
                //console.log("Track ", lineToTrack[lineNumber], " muted");
            }
        },

        resetAll: function() {
            //Restore everything
            this.reset = true;
            this.updateRequired = true;
            manager.setPlaybackRate(1);
            manager.setFilterFrequency(1000, 0);
            for(var i=0; i<this.noteLines.length; ++i) {
                this.resetLine(null, i);
            }
        }
    };

    game.state.add("Pyramid", Pyramid);
    game.state.start("Pyramid");
});
