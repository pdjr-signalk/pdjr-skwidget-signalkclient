# pdjr-skwidget-wsclient

__pdjr-skwidget-wsclient__ is just an envelope for __SignalkClient__.
implements some Signal K client functions for Signal K webapps.

__SignalkClient__ provides an efficient websocket connection for webapps
 * wanting to connect to a Signal K server. The class implements a
 * singleton client interface and installs it under window.top so that
 * it can be can by an arbitrary number widgets distributed across an
 * arbitrary number of webapps in an arbitrary number of windows.
 *
 * The class provides mechanisms for accessing and updating data on the
 * remote server and for subscribing to the severs delta model for
 * event driven updates.
 *
 * Creating a trivial, dynamically updates, display component can be as
 * simple as:
 *
 * <!DOCTYPE html>
 * <html>
 * <head>
 *   <script type="text/javascript" src="SignalkClient.js"></script>
 * </head>
 * <script>
 *   function init() {
 *     var signalkClient = SignalkClient.install();
 *     signalkClient.waitForConnection().then(
 *       () => {
 *         signalkClient.onValue("tanks.wasteWater.0.currentLevel", "#waste");
 *       },
 *       () => {
 *         console.log("error initialising Signal K client library");
 *       }
 *     );
 *   }
 * </script>
 * <body onload="init();">
 *   <div id="waste"></div>
 *   <div id="fuel"></div>
 * </body>
 * </html>
 */






class SignalkClient {

  /********************************************************************
   * SignalkClient.install(host, port[, debug])
   *
   * Perhaps install an instance of SignalkClient under window.top.
   *
   * SignalkClient optimises the connection to a remotes Signal K
   * server by multiplexing a single connection across an arbitrary
   * number of clients within the same browser context. This method
   * checks to see if window.top.SignalkClient exists and, if it does,
   * simply returns a reference to this already installed instance.
   *
   * If window.top.SignalkClient is undefined, then this method creates
   * a new SignalkClient instance and installs it. For a description of
   * the method arguments see the following comments relating to the
   * constructor method. If either or both <host> and <port> are not
   * supplied then they will default to values drawn from the
   * window.top.location property.
   *
   * In either case, the method returns a reference to
   * window.top.SignalkClient or throws an error if there is a problem. 
   */

  static install(host=window.top.location.hostname, port=window.top.location.port, debug=true) {
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

  /********************************************************************
   * new SignalkClient(host, port[, debug])
   *
   * Create and return a new SignalkClient instance and initiate an
   * asynchronous connection to the Signal K server at <host>:<port>.
   * See isConnected() and waitForConnection() for methods which
   * support detection of when the connection completes.
   *
   * The boolean <debug> argument can be used to enable trace output to
   * console.log.
   *
   * The directory holds entries with three properties:
   * callback:    is the unique identifier associated with the callback
   *              and ensures that duplicate entries do not occur.
   * appcallback: the function that should be called when an upade
   *             appears in the associated path.
   * simple:     true to pass just a value to callback; false to pass
   *             an object { source, timestamp, value }.
   */

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

  /********************************************************************
   * getHost()
   *
   * Get the string that was passed to the constructor as its <host>
   * argument.
   */

  getHost() {
    if (this.debug) console.log("signalkclient.getHost()...");
    return(this.host);
  }

  /********************************************************************
   * getPort()
   *
   * Get the number that was passed to the constructor as its <port>
   * argument.
   */

  getPort() {
    if (this.debug) console.log("signalkclient.getPort()...");
    return(this.port);
  }

  /********************************************************************
   * isConnected()
   *
   * Get a boolean representing whether or not the instance has an
   * active websocket connection to the Signal K server.
   */

  isConnected() {
    if (this.debug) console.log("signalkclient.isConnected()...");
    return(this.ws != null);
  }

  /********************************************************************
   * waitForConnection[timeout])
   *
   * Get a promise that resolves if/when the server connection
   * is/becomes open. The polling interval for the connection check can
   * be set with <timeout>. For example:
   *
   * (new SignalkClient()).waitForConnection().then(
   *   () => { ...do my application stuff... },
   *   () => { ...acknowledge failure... }
   * );
   *
   * This is the recommended top-level pattern for an application that
   * used SignalkClient. 
   */

  waitForConnection(timeout=500) {
    if (this.debug) console.log("signalkclient.waitForConnection(%d)...", timeout);

    const poll = resolve => {
      if (this.ws.readyState === WebSocket.OPEN) { resolve(); } else { setTimeout(_ => poll(resolve), timeout); }
    }
    return new Promise(poll);
  }

  /********************************************************************
   * getAvailablePaths(callback)
   *
   * Recover the currently available server paths and pass them as an
   * array to the <callback> function.
   */

  getAvailablePaths(callback) {
    if (this.debug) console.log("signalkclient.getAvailablePaths(%o)...", callback);

    if (!callback) throw "signalkclient.getValue: callback must be specified";

    this.getValue("", (v) => { callback(SignalkClient.getPath(v)); }, (v) => v);
  }

  /********************************************************************
   * getValue(path, callback[, filter])
   *
   * Get the current value of <path> from the Signal K server and
   * process it dependent on the type of <callbck> in the following
   * way:
   *
   * | Type of <callback> | Action                                    |
   * |:-------------------|:------------------------------------------|
   * | function           | Call <callback> with the recovered value  |
   * |                    | as its only argument.                     |
   * | string             | Convert <callback> into an HTMLElement    |
   * |                    | using document.querySelector(<callback>)  |
   * |                    | and process further.                      |
   * | HTMLElement        | Replace the HTML content of <callback>    |
   * |                    | with the returned value.                  |
   * | object             | Call <callback>.update() with the         |
   * |                    | returned value as argument.               |
   *
   * If <filter> is not specified and the value of <path> is an object
   * containing a 'value' property then the result will be the value of
   * <path>'s 'value' property, otherwise it will simply be the value
   * of <path>. This allows a <path> like "tanks.fuel.0.currentLevel"
   * to act as an alias for "tanks.fuel.0.currentLevel.value".
   *
   * If a <filter> is defined, then it must be a function taking a
   * single argument. The value of <path> will be transformed by
   * <filter> before use. So, if you want to recover the complete
   * object returned from a path like "tanks.fuel.0.currentLevel" it is
   * necessary to pass the identity function as <filter>.
   */

  getValue(path, callback, filter=undefined) {
    if (this.debug) console.log("signalkclient.getValue(%s,%o,%o)...", path, callback, filter);

    //if (!path) throw "signalkclient.getValue: subscription path must be defined";
    if (!callback) throw "signalkclient.getValue: callback must be specified";

    SignalkClient.httpGet(SignalkClient.normalisePath(path), (v) => {
      v = JSON.parse(v);
      SignalkClient.performAction(callback, ((filter)?filter(v):((v.value)?v.value:v)));
    });
  }

  /********************************************************************
   * putValue(path, value)
   *
   * Send a PUT delta requesting that <path> be updated with <value>.
   * Returns a request id which may be used to match up any response.
   */

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

  /********************************************************************
   * onValue(path, callback[, filter[, simple]])
   *
   * Registers <callback> so that it will receive data updates from the
   * server each time the value of <path> changes. See getValue()
   * above for a description of how <callback> and <filter> arguments
   * can be used to tweak the returned value and how it is processed.
   *
   * The recovered value made available to the application is usually
   * just the simple, undecorated, value recovered from the server and
   * after any processing by <filter>. Setting <simple> to false will
   * cause the application to receive instead an object of the form
   * { value, source, timestamp }.
   */

  onValue(path, callback, filter=undefined, simple=true) {
    console.log("signalkclient..onValue(%s,%o,%o,%s)...", path, callback, filter, simple);

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
    
  /********************************************************************
   * LEGACY METHODS AND ALIASES
   */

  getEndpoints() { this.getAvailablePaths(); }
  getSelfPath(path, callback, filter=undefined) { this.getValue(path, callback, filter); }
  registerCallback(path, callback, filter=undefined) { this.onValue(path, callback, filter); }
  registerInterpolation(path, element, filter=undefined) { this.interpolateValue(path, element, filter); }

  /********************************************************************
   * Asynchronously recover the document returned by an HTTP GET on
   * <url>. <callbacK receives the data or null if the GET request
   * fails.
   */

  static httpGet(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { if (xmlHttp.readyState == 4 && xmlHttp.status == 200) callback(xmlHttp.responseText); };
    xmlHttp.open("GET", url, true);
    xmlHttp.send();
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
