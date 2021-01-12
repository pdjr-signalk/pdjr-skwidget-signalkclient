/**********************************************************************
 * Copyright 2018 Paul Reeve <preeve@pdjr.eu>
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

class SignalkClient {

  static install(host=window.top.location.hostname, port=window.top.location.port, debug=false) {
    if (window.top.SignalkClient) {
      return(window.top.SignalkClient);
    } else {
      try {
        window.top.SignalkClient = new SignalkClient(host, parseInt(port), debug);
        return(window.top.SignalkClient);
      } catch(e) {
        console.log(e);
      }
    }
    return(null)
  }

  constructor(host, port, debug=false) {
    if (debug) console.log("SignalkClient(%s,%d,%s)...", host, port, debug);

    this.host = host;
    this.port = parseInt(port);
    this.debug = debug;

    this.ws = null;
    this.directory = {};

    if ((this.host) && (this.port)) {
      console.log("signalkclient: opening websocket connection to %s:%d", this.host, this.port);
      this.ws = new WebSocket("ws://" + host + ":" + port + "/signalk/v1/stream?subscribe=none");
      this.ws.onopen = function(evt) {
        console.log("signalkclient: connection established");
      }.bind(this);
      this.ws.onerror = function(evt) {
        throw "signalkclient: error: connection failed";
        this.ws = null;
      }.bind(this);
      this.ws.onmessage = function(evt) { 
        var data = JSON.parse(evt.data);
        if ((data.updates !== undefined) && (data.updates.length > 0)) {
          data.updates.forEach(update => {
            var source = update["$source"];
            var timestamp = update["timestamp"];
            if ((update.values !== undefined) && (update.values.length > 0)) {
              update.values.forEach(updateValue => {
                var path = updateValue.path;
                var value = updateValue.value;
                if ((path !== undefined) && (value !== undefined) && (this.directory[path] !== undefined)) {
                  this.directory[path].forEach(entry => {
                    entry.callback(entry.appcallback, (entry.simple)?value:{ "source": source, "timestamp": timestamp, "value": value });
                  });
                }
              });
            }
          });
        } else {
          //console.log("%o", data);
        }
      }.bind(this);
    } else {
      throw "SignalkClient: invalid host specification";
    }
  }

  getHost() {
    if (this.debug) console.log("signalkclient.getHost()...");
    return(this.host);
  }

  getPort() {
    if (this.debug) console.log("signalkclient.getPort()...");
    return(this.port);
  }

  isConnected() {
    if (this.debug) console.log("signalkclient.isConnected()...");
    return(this.ws != null);
  }

  waitForConnection(timeout=500) {
    if (this.debug) console.log("signalkclient.waitForConnection(%d)...", timeout);

    const poll = resolve => {
      if (this.ws.readyState === WebSocket.OPEN) { resolve(); } else { setTimeout(_ => poll(resolve), timeout); }
    }
    return new Promise(poll);
  }

  getAvailablePaths(callback) {
    if (this.debug) console.log("signalkclient.getAvailablePaths(%o)...", callback);

    if (!callback) throw "signalkclient.getValue: callback must be specified";

    this.getValue("", (v) => { callback(SignalkClient.getPath(v)); }, (v) => v);
  }

  getValue(path, callback, filter=undefined) {
    if (this.debug) console.log("signalkclient.getValue(%s,%o,%o)...", path, callback, filter);

    //if (!path) throw "signalkclient.getValue: subscription path must be defined";
    if (!callback) throw "signalkclient.getValue: callback must be specified";

    SignalkClient.httpGet(SignalkClient.normalisePath(path), (v) => {
      v = JSON.parse(v);
      SignalkClient.performAction(callback, ((filter)?filter(v):((v.value)?v.value:v)));
    });
  }

  getValueAsync(path, filter=undefined) {
    if (this.debug) console.log("signalkclient.getValueAsync(%s,%o)...", path, filter);

    //if (!path) throw "signalkclient.getValue: subscription path must be defined";

    var retval = SignalkClient.httpGetAsync(SignalkClient.normalisePath(path));
    if (retval) {
      retval = JSON.parse(retval);
      retval = (filter)?filter(retval):((retval.value)?retval.value:retval);
    }
    return(retval);
  }

  putValue(path, value) {
    if (this.debug) console.log("signalkclient.putValue(%s,%o)...", path, value);

    if (!path) throw "signalkclient.putValue: path must be defined";
    if (!value) throw "signalkclient.putValue: value must be specified";

    var random = new Uint32Array(3); window.crypto.getRandomValues(random);
    var uuid = "" + random[0] + "-" + random[1] + "-" + random[2];
    var delta = { "context": "vessels.self", "requestId": uuid, "put": { "path": path, "value": value, } };
    this.ws.send(JSON.stringify(delta));
    return(uuid);
  }

  onValue(path, callback, filter=undefined, simple=true) {
    if (this.debug) console.log("signalkclient..onValue(%s,%o,%o,%s)...", path, callback, filter, simple);

    if (!path) throw "signalkclient.onValue: subscription path must be defined";
    if (!callback) throw "signalkclient.onValue: callback must be defined";
    if (!this.ws) throw "signalkclient.onValue: cannot register subscription because websocket is closed";

    if (this.directory[path] === undefined) {
      this.directory[path] = [];
      var subscriptions = [ { "path": path, "minPeriod": 1000, "policy": "instant" } ];
      var msg = { "context": "vessels.self", "subscribe": subscriptions };
      this.ws.send(JSON.stringify(msg));
    }

    if (!this.directory[path].map(e => e.appcallback).includes(callback)) {
      this.directory[path].push({ appcallback: callback, simple: simple, callback: (actor, v) => {
        SignalkClient.performAction(actor, (filter)?filter(v):((v.value !== undefined)?v.value:v));
      }});
    } else {
      console.log("signalkclient: warning: refusing to register a duplicate callback");
    }
  }
    
  getEndpoints() { this.getAvailablePaths(); }
  getSelfPath(path, callback, filter=undefined) { this.getValue(path, callback, filter); }
  registerCallback(path, callback, filter=undefined) { this.onValue(path, callback, filter); }
  registerInterpolation(path, element, filter=undefined) { this.interpolateValue(path, element, filter); }

  static httpGet(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { if (xmlHttp.readyState == 4 && xmlHttp.status == 200) callback(xmlHttp.responseText); };
    xmlHttp.open("GET", url, true);
    xmlHttp.send();
  }

  static httpGetAsync(url) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open('GET', url, false);
    xmlHttp.send(null);
    return((xmlHttp.status === 200)?xmlHttp.responseText:null);
  }

  static performAction(actor, value) {
    if (typeof actor == "string") actor = document.querySelector(actor);
    switch (typeof actor) {
      case "object":
        if (actor instanceof HTMLElement) {
          actor.innerHTML = value;
        } else {
          actor.update(value);
        }
        break;
      case "function":
        actor(value);
        break;
      default:
        throw "signalkclient: performaction: invalid actor";
        break;
    }
  }
    
  static normalisePath(path) {
    var retval = "/signalk/v1/api/vessels/self/";
    var parts = path.split("[");
    retval += parts[0].replace(/\./g, "/");
    if (parts[1] !== undefined) retval += ("[" + parts[1]);
    return(retval);
  }

  static getPath(tree, value="", accumulator=[]) {
    if ((tree) && (typeof tree === "object")) {
      var keys = Object.keys(tree);
      if ((keys.length > 0) && (!keys.includes("value"))) {
        keys.forEach(key => {
          accumulator = SignalkClient.getPath(tree[key], (value + ((value.length > 0)?".":"") + key), accumulator);
        });
      } else {
        accumulator.push(value);
      }
    } else {
      accumulator.push(value);
    }
    return(accumulator);
  }

}
