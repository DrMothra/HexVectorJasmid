/**
 * Created by DrTone on 10/02/2016.
 */

//Handle web socket connections

var IDLE= 0, CONNECTING=1, CONNECTED=2;
var connectionManager = (function() {

    var status = IDLE;
    var wsUrl;
    var wsPort;
    var socket;
    var userId;

    return {
        init: function(id) {
            userId = id;
        },

        connect: function(url, port, callback) {
            status = CONNECTING;
            //Construct url + port;
            wsUrl = url + ":" + port;
            socket = new WebSocket(wsUrl);
            socket.onopen = function() {
                //DEBUG
                //console.log("Connected");
                //$('#debug').html("Connected");

                status = CONNECTED;
            };

            socket.onmessage = function(event) {
                //DEBUG
                //console.log("Received msg = ", event.data);
                if(userId.indexOf("server") !== -1) return;
                if(event.data.indexOf('Sync') !== -1) {
                    callback(event.data);
                }
            };

            socket.onerror = function(event) {
                //DEBUG
                //console.log("Socket error");
                alert("Cannot connect to websocket server");
            };

            socket.onclose = function(event) {
                //DEBUG
                //console.log("Socket closed");
            }
        },

        sendMessage: function(msg) {
            socket.send(msg);
        }
    }
})();