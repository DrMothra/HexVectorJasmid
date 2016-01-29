/**
 * Created by DrTone on 29/01/2016.
 */

//Load all soundfonts


function loadRequest(soundfontpath, instrument, onLoaded) {
    var url = soundfontpath + instrument + '-mp3.js';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function(event) {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                var response = event.target.responseText;
                onLoaded.call(response);
            } else {
                console.log("Couldn't load soundfont file!");
            }
        }
    };

    xhr.send();
}
