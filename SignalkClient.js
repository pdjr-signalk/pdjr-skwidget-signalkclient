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

  /********************************************************************
   * If an instance of SignalkClient already exists at
   * app.top.SignalClient then a reference to it is returned.
   *
   * If an instance of SignalkClient does not exist at this location,
   * then a new instance is created and a connecion to the Signal K
   * server at <host>:<port> is initiated. In this case, a reference
   * to the newly installed instance is returned or null on error.
   */

  static install(host=window.top.location.hostname, port=window.top.location.port, debug=false) {
    if (window.top.SignalkClient) {
      return(window.top.SignalkClient);
    } else {
      try {
        window.top.SignalkClient = new SignalkClient(host, port, debug);
        return(window.top.SignalkClient);
      } catch(e) {
        console.log(e);
      }
    }
    return(null)
  }

  constructor(host, port, debug=false) {
    if (debug) console.log("SignalkClient(%s,%d,%d)...", host, port, debug);

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
                  this.directory[path].forEach(callback => callback({ "source": source, "timestamp": timestamp, "value": value }));
                }
              });
            }
          });
        } else {
          //console.log("%o", data);
        }
      }.bind(this);
    } else {
      throw "signalkclient: error: invalid host specification";
    }
  }

  /********************************************************************
   * Return the hostname of the remote Signal K server connection.
   */

  getHost() {
    return(this.host);
  }

  /********************************************************************
   * Return the port number of the remote Signal K server connection.
   */

  getPort() {
    return(this.port);
  }

  /********************************************************************
   * Returns true if the client has an open connection to the server.
   */

  isConnected() {
    return(this.ws != null);
  }

  /********************************************************************
   * Returns a promise that resolves if/when the server connection is/
   * becomes open. The polling interval for the connection check can
   * be set with <timeout>.
   */

  waitForConnection(timeout=500) {
    const poll = resolve => {
      if (this.ws.readyState === WebSocket.OPEN) { resolve(); } else { setTimeout(_ => poll(resolve), timeout); }
    }
    return new Promise(poll);
  }

  /********************************************************************
   * Requests a list of all server keys and returns this as an array
   * to <callback>.
   */

  getEndpoints(callback) {
    var everything = this.getValue("", undefined, v=>v);
    callback(this.getPath(everything, "", []));
  }
    
  getPath(tree, value, accumulator) {
    if ((tree) && (typeof tree === "object")) {
      var keys = Object.keys(tree);
      if ((keys.length > 0) && (!keys.includes("value"))) {
        keys.forEach(key => {
          accumulator = this.getPath(tree[key], (value + ((value.length > 0)?".":"") + key), accumulator);
        });
      } else {
        accumulator.push(value);
      }
    } else {
      accumulator.push(value);
    }
    return(accumulator);
  }

  subscribe(path, callback, filter) {
    this.registerCallback(path, callback, filter);
  }

  /********************************************************************
   * Registers a <callback> function against a Signal K <path>. The
   * <callback> will receive delta updates from the server which can
   * optionally be processed using a <filter> function.
   */

  registerCallback(path, callback, filter) {
    console.log("signalkclient: registerCallback(%s,%o,%o)...", path, callback, filter);
    if (!path) throw "signalkclient: error: subscription path must be defined";
    if (!callback) throw "signalkclient: error: callback function must be defined";
    if (!this.ws) throw "signalkclient: error: cannot register subscription because websocket is closed";

    if (this.directory[path] === undefined) {
      this.directory[path] = [];
      var subscriptions = [ { "path": path, "minPeriod": 1000, "policy": "instant" } ];
      var msg = { "context": "vessels.self", "subscribe": subscriptions };
      this.ws.send(JSON.stringify(msg));
    }

    if (!this.directory[path].includes(callback)) {
      this.directory[path].push((v) => {
        v = (filter)?filter(v):((v.value !== undefined)?v.value:v);
        switch (typeof callback) {
          case "object": callback.update(v); break;
          case "function": callback(v); break;
          default: break;
        }
      });
    } else {
      console.log("signalkclient: warning: refusing to register a duplicate callback");
    }
  }

  registerInterpolation(path, element, filter) {
    //console.log("registerInterpolation(%s,%s,%s)...", path, element, filter);
 
    this.registerCallback(path, function(v) { element.innerHTML = v; }.bind(this), filter);
  }

  /********************************************************************
   * Recovers a value from the host server data tree.
   *
   * If a <filter> function is defined, then the returned value is
   * passed directly to <filter> as its only argument. <filter> should
   * process and promptly return the processed value.
   *
   * If a <filter> function is not defined: if the the returned value
   * has a property called 'value' then value.value becomes the result,
   * otherwise value is returned as the result.
   *
   * value is filtered through <filter> if specified.
   * @param path is a key under vessels.self.
   * @callback is either a function , returning it
   * directly or through <callback>. <path> specifies a path under
   * vessels.self 
   */

  getValue(path, callback, filter) {
    if (this.debug) console.log("signalkclient: getValue(%s,%o,%o)...", path, callback, filter);

    var retval = null
    
    SignalkClient.httpGet(SignalkClient.normalisePath(path), (v) => {
      v = JSON.parse(v);
      v = (filter)?filter(v):((v.value !== undefined)?v.value:v);
      if (callback !== undefined) {
        switch (typeof callback) {
          case "object": callback.update(v); break;
          case "function": callback(v); break;
          default: break;
        }
      } else {
        retval = v;
      }
    });
    return(retval);
  }

  interpolateValue(path, element, filter) {
    //console.log("interpolateValue(%s,%s,%s)...", path, element, filter);

    this.getValue(path, function(v) { element.innerHTML = v; }.bind(this), filter);
  }

  async get(theUrl) {
    var response = await fetch(theUrl);
    if (response.status == 200) {
      var result = await response.text();
      return(result);
    } else {
      return(null);
    }
  }

  /********************************************************************
   * Asynchronously recover the document returned by an HTTP GET on
   * <url>. <callbacK receives the data or null if the GET request
   * fails.
   */

  static httpGet(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { callback((xmlHttp.readyState == 4 && xmlHttp.status == 200)?xmlHttp.responseText:null); };
    xmlHttp.open("GET", url, true);
    xmlHttp.send();
  }

  /********************************************************************
   * Send a PUT delta requesting that <path> be updated with <value>.
   * Returns an identifier for the request which may be used to match
   * up any response.
   */

  putValue(path, value) {
    if (debug) console.log("signalkclient: putValue(%s,%o)...", path, value);
    var requestId = "184743-434373-348483";
    var delta = {
      "context": "vessels.self",
      "requestId": requestId,
      "put": { "path": path, "value": value, }
    };
    this.ws.send(JSON.stringify(delta));
    return(requestId);
  }
    
  /********************************************************************
   * Returns <path> after processing into a normal form that a Signal
   * K server can consume by:
   * * adding a prefix to vessels.self
   * * replacing '.' separators with '/' separators.
   */

  static normalisePath(path) {
    var retval = "/signalk/v1/api/vessels/self/";
    var parts = path.split("[");
    retval += parts[0].replace(/\./g, "/");
    if (parts[1] !== undefined) retval += ("[" + parts[1]);
    return(retval);
  }

}
