# pdjr-skwidget-signalkclient

The __pdjr-skwidget-signalkclient__ library has a single member class
described below.

## SignalikClient

__SignalkClient__ provides an efficient websocket connection for
webapps wanting to interact with a Signal K server.

The class implements a singleton instance which optimises the
connection to a remotes server by multiplexing a single connection
across an arbitrary number of clients within the same browser
context.

__SignalkClient__ provides mechanisms for accessing and updating data
on the remote Signal K server and for subscribing to delta updates.

Creating a trivial, webapp that dynamically updates its display can be 
as simple as:
```
<!DOCTYPE html>
<html>
<head>
  <script type="text/javascript" src="SignalkClient.js"></script>
</head>
<script>
  function init() {
    var signalkClient = SignalkClient.install();
    signalkClient.waitForConnection().then(
      () => {
        signalkClient.onValue("tanks.wasteWater.0.currentLevel", "#waste");
      },
      () => {
        console.log("error initialising Signal K client library");
      }
    );
  }
</script>
<body onload="init();">
   <div id="waste"></div>
   <div id="fuel"></div>
</body>
</html>
```

### SignalkClient.install([_port_[, _host_[, _debug_=false]]])

Factory method to perhaps create and install an instance of
__SignalkClient__ under ```window.top```.
__install__ should be the only method an application uses to acquire
a connection to remote Signal K server: DO NOT call the constructor
directly.

__install__ checks to see if ```window.top.SignalkClient``` exists and,
if it does, simply returns a reference to this already installed
instance.
If ```window.top.SignalkClient``` is undefined, then __install__
creates a new __SignalkClient__ instance and installs it as
```window.top.SignalkClient```.

_port_ can be used to specify the internet port on which the Signal K
server offers a websocket service and _host_ can be used to explicitly
supply a server hostname or IP address. The _debug_ boolean can be used
to enable trace output to console.log.  
If either or both <host> and <port> are not supplied then they will
default to values drawn from the ```window.top.location``` property and
usually this works pretty well for Signal K webapp applications.

#### Example
```
try {
  var signalkClient = SignalkClient.install();
} catch(e) {
  console.log(e);
}
```

### new SignalkClient(_host_, _port_[, _debug_=false])

Creates and returns a new __SignalkClient__ instance and initiates an
asynchronous connection to the Signal K server at _host_:_port_.
The boolean _debug_ argument can be used to enable trace output to
console.log.

You probably don't want to do this: see __install()__ above.

### getHost()
   
Get the string that was passed to the constructor as its _host_ argument.

#### Example
```
console.log(signalkClient.getHost());
```

### getPort()

Get the number that was passed to the constructor as its _port_ argument.

#### Example
```
console.log(signalkClient.getPort());
```

### isConnected()
 
Get a boolean representing whether or not the instance has an active
websocket connection to the Signal K server.

#### Example
```
if (signalkClient.isConnected()) console.log("We have a connection");
```

### waitForConnection(_timeout_=500)

Get a promise that resolves if/when the server connection is/becomes
open.
The polling interval for the connection check can be set with _timeout_.

#### Example
```
var signalkClient = new SignalkClient();

signalkClient.waitForConnection().then(
  () => {
     ...do my application stuff...
  },
  () => { console.log("Connection failed"); }
);
```
This is the recommended top-level pattern for an application that uses
__SignalkClient__. 

### getAvailablePaths(_callback_)

Recover all the currently available server paths and pass them as an
array to the _callback_ function.

#### Example
```
signalkServer.getAvailablePaths((paths) => {
  console.log("There are %d available paths", paths.length);
});
```

### getValue(_path_, _callback_[, _filter_])

Get the current value of _path_ from the Signal K server, transform it
through _filter_ (if supplied) and process it dependent on the type of
_callback_.

If _filter_ is not specified and the value of _path_ is an object
containing a 'value' property then the path value will be transformed
into value['value'].
This allows a _path_ like 'tanks.fuel.0.currentLevel' to act as an
alias for 'tanks.fuel.0.currentLevel.value'.

If _filter_ is defined, then it must be a function taking a single
argument.
The value of _path_ will be transformed by _filter_ before use.
So, if you want to recover the complete object returned from a path
like 'tanks.fuel.0.currentLevel' then it is necessary to pass the
identity function as _filter_.

Exactly what is done with the _path_ value after any transformation is
dependent upon the type of _callback_ as described in the following
table.

| Type of _callback_ | Action |
|:-------------------|:-------|
| function           | Call _callback_ with the recovered value as its only argument. |
| string             | Convert _callback_ into an HTMLElement using document.querySelector(_callback_) and process further. |
| HTMLElement        | Replace the HTML content of _callback_ with the returned value. |
| object             | Call _callback_.update() with the recovered value as its argument. |

#### Example

The following example updates the DOM element with id='tank-level'
with the percentage level in the waste tank. 
```
signalkClient.getValue("tanks.wasteLevel.0.currentLevel", "#tank-level", (v) => (v * 100).toFixed(0));
```

### putValue(_path_, _value_)

Send a PUT delta requesting that _path_ be updated with _value_.
Returns a request id string which may be used to match up any response.

### onValue(_path_, _callback_[, _filter_[, _simple_]])

Registers _callback_ so that it will receive updates each time the
value of _path_ changes.
See __getValue()__ above for a description of how _callback_ and
_filter_ arguments can be used to tweak the recovered values and how
they will be processed.

The recovered value made available to _callback_ is usually just the
simple, undecorated, value recovered from the server after any
processing by _filter_.
Setting _simple_ to false will cause the application to receive
instead an object with properties __value__, __source__ and
__timestamp__ derived from the received delta update.

#### Example
```
signalkClient.onValue("tanks.fuel.3.currentLevel", (v) => {
  console.log("Received %d with timestamp %s generated by %s", v.value, v.timestamp, v.source);
}, undefined, false);
```

### SignalkClient.httpGet(_url_, _callback_)

Recover the document returned by an HTTP GET on _url_.
_callback_ receives the data or null if the GET request fails.

### Legacy methods

__getEndpoints()__ (replaced by __getAvailablePaths()__).\
__getSelfPath(_path_, _callback_[, _filter_=undefined])__ (replaced by __getValue()__).\
__registerCallback(_path_, _callback_[, _filter_=undefined])__ (replaced by __onValue()__).\
__registerInterpolation(_path_, _element_[, _filter_=undefined])__ (replaced by __onValue()__).
