'use strict';
let apiKey;
let loc;
let lastSearch;
let dialog;

function get_settings() {
    chrome.storage.sync.get({
        WxApiKey: '',
        WxLocValue: 'auto:ip',
        WxLocType: 'local-ip',
        WxLatLong: ["51.50", "-0.12"], // The coordinates of London!
        WxIpAddr: "",
        WxUsZip: "10001", // A NYC zip code
        WxUkPostCode: "E1 7HT", // Uses a London postal code by default
        WxCanPostCode: "V5J", // Uses a Vancouver postal code by default
        WxMetarCode: "",
        WxIataCode: "LGA", // using laguardia
        WxLastSearch: ""
    }, items => {
        apiKey = items.WxApiKey;
        document.getElementById('wxapi-key').value = apiKey = items.WxApiKey;
        loc = items.WxLocValue;
        document.getElementById(items.WxLocType).checked = true;
        document.getElementById("latitude").value = items.WxLatLong[0];
        document.getElementById("longitude").value = items.WxLatLong[1];
        document.getElementById("us-zip").value = items.WxUsZip;
        document.getElementById("uk-post").value = items.WxUkPostCode;
        document.getElementById("ca-post").value = items.WxCanPostCode;
        document.getElementById("metar-code").value = items.WxMetarCode;
        document.getElementById("iata-code").value = items.WxIataCode;
        var ls = items.WxLastSearch ? items.WxLastSearch : "N/A";
        document.querySelector('label[for="last-used-search"]').innerHTML = "<span><span></span></span>Last used search location: " + ls;
        if (ls != "N/A") {
            document.getElementById("last-used-search").disabled = false;
            lastSearch = ls;
        }
    });
    set_onclicks();
}

function save_settings() {
    update_location();
    let wxapi_ent = document.getElementById("wxapi-key");
    let WxApiKey = wxapi_ent.value? wxapi_ent.value : apiKey;
    let WxLocValue = loc;
    let WxLocType = "local-ip";

    var lt0 = document.getElementById('local-ip');
    if (lt0) {
        WxLocType = lt0.checked ? 'local-ip' : WxLocType;
    }

    var lt1 = document.getElementById('ip-input');
    if (lt1) {
        WxLocType = lt1.checked ? 'ip-input' : WxLocType;
    }

    var lt2 = document.getElementById('lat-lon');
    if (lt2) {
        WxLocType = lt2.checked ? 'lat-lon' : WxLocType;
    }

    var lt3 = document.getElementById('zip-code');
    if (lt3) {
        WxLocType = lt3.checked ? 'zip-code' : WxLocType;
    }

    var lt4 = document.getElementById('uk-postal');
    if (lt4) {
        WxLocType = lt4.checked ? 'uk-postal' : WxLocType;
    }

    var lt5 = document.getElementById('canada-post');
    if (lt5) {
        WxLocType = lt5.checked ? 'canada-post' : WxLocType;
    }

    var lt6 = document.getElementById('metar');
    if (lt6) {
        WxLocType = lt6.checked ? 'metar' : WxLocType;
    }

    var lt7 = document.getElementById('iata');
    if (lt7) {
        WxLocType = lt7.checked ? 'iata' : WxLocType;
    }

    var lt8 = document.getElementById('search');
    if (lt8) {
        WxLocType = lt8.checked ? 'search' : WxLocType;
    }

    var lt9 = document.getElementById('last-used-search');
    if (lt9) {
        WxLocType = lt9.checked ? 'last-used-search' : WxLocType;
    }

    let [lat, long] = [document.getElementById("latitude").value, document.getElementById("longitude").value];
    let WxLatLong = [lat, long];
    let WxIpAddr = document.getElementById("ip-address").value;
    let WxUsZip = document.getElementById("us-zip").value;
    let WxUkPostCode = document.getElementById("uk-post").value;
    let WxCanPostCode = document.getElementById("ca-post").value;
    let WxMetarCode = document.getElementById("metar-code").value;
    let WxIataCode = document.getElementById("iata-code").value;
    var piss = document.getElementById("search-query").value; // search query box value
    let WxLastSearch = lastSearch ? lastSearch : piss ? piss : "N/A";

    chrome.storage.sync.set({
        WxApiKey,
        WxLocValue,
        WxLocType,
        WxLatLong,
        WxIpAddr,
        WxUsZip,
        WxUkPostCode,
        WxCanPostCode,
        WxMetarCode,
        WxIataCode,
        WxLastSearch
    });
    console.log(WxApiKey,
        WxLocValue,
        WxLocType,
        WxLatLong,
        WxIpAddr,
        WxUsZip,
        WxUkPostCode,
        WxCanPostCode,
        WxMetarCode,
        WxIataCode,
        WxLastSearch);
}
function update_location() {
    let LocationType = "";
    let pp = document.querySelectorAll('input[name="location-type"]');

    pp.forEach(element => {
        var id = element.id;
        if (element.checked) LocationType = id;
    });
    
    switch (LocationType) {
        case 'local-ip':
            loc = 'auto:ip';
            return;
        case 'ip-input':
            loc = document.getElementById("ip-address").value;
            return;
        case 'lat-long':
            let [lat, long] = [document.getElementById('latitude').value, document.getElementById('longitude').value];
            loc = `${lat},${long}`;
            return;
        case 'zip-code':
            loc = document.getElementById("us-zip").value;
            return;
        case 'uk-postal':
            loc = document.getElementById("uk-post").value;
            return;
        case 'canada-post':
            loc = document.getElementById('ca-post').value;
            return;
        case 'metar':
            loc = `metar:${document.getElementById('metar-code').value}`;
            return;
        case 'iata':
            loc = `iata:${document.getElementById('iata-code').value}`;
            return;
        case 'search':
            search_location(); // call search function JIC
            return;
        case 'last-used-search':
            loc = lastSearch;
            return;
        default:
            loc = 'auto:ip';
    }
    loc = 'auto:ip'; // In case 
}

function* get_associated_elements(elements) {
    if (elements) {
        for (var i = 0; i < elements.length; i++) {
            if (elements[i]) yield document.getElementById(elements[i]);
            else yield;
        }
    }
}
function set_onclicks() {
    var elem0 = document.getElementById('local-ip');
    if (elem0) {
        elem0.onclick = function () {
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem1 = document.getElementById('ip-input');
    if (elem1) {
        elem1.onclick = function () {
            var e0 = document.getElementById('ip-address');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element ip-address");
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem2 = document.getElementById('lat-lon');
    if (elem2) {
        elem2.onclick = function () {
            var e0 = document.getElementById('latitude');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element latitude");
           var e1 = document.getElementById('longitude');
            if (e1) e1.disabled = false;
            else console.warn("Could not find element longitude");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem3 = document.getElementById('zip-code');
    if (elem3) {
        elem3.onclick = function () {
            var e0 = document.getElementById('us-zip');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element us-zip");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem4 = document.getElementById('uk-postal');
    if (elem4) {
        elem4.onclick = function () {
            var e0 = document.getElementById('uk-post');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element uk-post");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem5 = document.getElementById('canada-post');
    if (elem5) {
        elem5.onclick = function () {
            var e0 = document.getElementById('ca-post');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element ca-post");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem6 = document.getElementById('metar');
    if (elem6) {
        elem6.onclick = function () {
            var e0 = document.getElementById('metar-code');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element metar-code");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem7 = document.getElementById('iata');
    if (elem7) {
        elem7.onclick = function () {
            var e0 = document.getElementById('iata-code');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element iata-code");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
        }
    }

   var elem8 = document.getElementById('search');
    if (elem8) {
        elem8.onclick = function () {
            var e0 = document.getElementById('search-query');
            if (e0) e0.disabled = false;
            else console.warn("Could not find element search-query");
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var e1 = document.getElementById('commit-search');
            if (e1) {
                e1.disabled = false;
            }
        }
    }

   var elem9 = document.getElementById('last-used-search');
    if (elem9) {
        elem9.onclick = function () {
            var p0 = document.getElementById('ip-address');
            if (p0) {
                p0.disabled = true;
            } else console.warn('could not find element ip-address');
            var p1 = document.getElementById('latitude');
            if (p1) {
                p1.disabled = true;
            } else console.warn('could not find element latitude');
            var p2 = document.getElementById('longitude');
            if (p2) {
                p2.disabled = true;
            } else console.warn('could not find element longitude');
            var p3 = document.getElementById('us-zip');
            if (p3) {
                p3.disabled = true;
            } else console.warn('could not find element us-zip');
            var p4 = document.getElementById('uk-post');
            if (p4) {
                p4.disabled = true;
            } else console.warn('could not find element uk-post');
            var p5 = document.getElementById('ca-post');
            if (p5) {
                p5.disabled = true;
            } else console.warn('could not find element ca-post');
            var p6 = document.getElementById('metar-code');
            if (p6) {
                p6.disabled = true;
            } else console.warn('could not find element metar-code');
            var p7 = document.getElementById('iata-code');
            if (p7) {
                p7.disabled = true;
            } else console.warn('could not find element iata-code');
            var p8 = document.getElementById('search-query');
            if (p8) {
                p8.disabled = true;
            } else console.warn('could not find element search-query');
            var p9 = document.getElementById('commit-search');
            if (p9) {
                p9.disabled = true;
            }
            // this is VERY MUCH spaghetti but it should work for now lmao
        }
    }
    
    document.getElementById("save_wx_loc").onclick = save_settings;

    document.getElementById("commit-search").onclick = search_location;
}
function get_weather() {
    key = document.getElementById("wxapi-key").value;
    if (!apiKey || apiKey != key) apiKey = key;
    let url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${loc}`;

}
function search_location() {
    let sq = document.getElementById('search-query');
    if (sq) {
        let key = document.getElementById("wxapi-key").value;
        if (!apiKey || apiKey != key) apiKey = key;
        let url = `https://api.weatherapi.com/v1/search.json?key=${apiKey}&q=${sq.value}`;
        let request = new XMLHttpRequest();

        request.onload = function() {
            if (request.status == 200 || request.status == 304) {
                let response = JSON.parse(request.responseText);
                if (response.length > 0) {
                    if (response.length > 1) {
                        if (!dialog) dialog = document.createElement('dialog');
                        else dialog.innerHTML = '';
                        var head = document.createElement('h1');
                        head.textContent = "Results for " + sq.value;
                        dialog.appendChild(head);
                        var instruct = document.createElement('p');
                        instruct.textContent = "Please select a location below.";
                        dialog.appendChild(instruct)
                        var listbox = document.createElement('select');
                        for (var i = 0; i < response.length; i++) {
                            var opt = document.createElement('option');
                            opt.value = response[i].id;
                            opt.text = response[i].name + ", " + response[i].region + ", " + response[i].country + " (" + response[i].lat + ", " + response[i].lon + ")";
                            listbox.appendChild(opt);
                        }
                        dialog.appendChild(listbox);
                        var confirmButton = document.createElement('button');
                        confirmButton.textContent = "Confirm";
                        confirmButton.onclick = function () {
                            if (listbox.selectedIndex != -1) {
                                var r = response[listbox.selectedIndex];
                                loc = 'id:' + r.id;
                                lastSearch = r.name + ', ' + r.region + ', ' + r.country;
                                dialog.close();
                                document.getElementById('weather').removeChild(dialog);
                            } else {
                                alert("Please select a location first.");
                            }
                        }
                        dialog.appendChild(confirmButton);
                        document.getElementById('weather').appendChild(dialog);
                        dialog.showModal();
                    } else {
                        loc = 'id:' + response[0].id;
                        lastSearch = response[0].name + ', ' + response[0].region + ', ' + response[0].country;
                    }
                } else {
                    alert("No results found for " + sq.value);
                }
            }
        };
        request.onerror = console.error;

        request.open("GET", url);
        request.send();
    }
}
//window.onload = get_settings;