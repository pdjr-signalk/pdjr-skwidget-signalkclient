# pdjr-skwidget-signalkclient

The __pdjr-skwidget-signalkclient__ library has a single member class
described below.

## SignalkClient

__SignalkClient__ implements a websocket connection to a Signal K server
and multiplexes this connection across an arbitrary number of clients
within the same browser context.

The class is designed to be instantiated as a singleton instance and
provides methods for programmed and event driven access to the remote
server's data store.

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
</body>
</html>
```

### SignalkClient.install([_port_[, _host_[, _debug_=false]]])

__install()__ is a factory method which prepares an application for
access to a remote Signak K server either by returning a reference to
an existing, connected, __SignalkClient__ singleton, or, if necessary,
by creating, installing, connecting and returning a reference to a new
class instance.
The __SignalkClient__ maintained by __install()__ can be found at
```window.top.SignalkClient```.

__install()__ should be the only method an application uses to acquire
a connection to a remote Signal K server: in normal circumstances it
will never be necessary for an application to call the class constructor
directly.

_port_ can be used to specify the internet port on which the Signal K
server offers a websocket service and _host_ can be used to explicitly
supply a server hostname or IP address. The _debug_ boolean can be used
to enable trace output to console.log.  
If either or both _host_ and _port_ are not supplied then they will
default to values drawn from the ```window.top.location``` property.
If __SignalkClient__ is being used in a webapp served by the Signal K
server then calling __install()__ with no arguments works because vanilla
Signal K server installations offer HTTP and websocket services on the
same port number.

#### Example
```
try {
  var signalkClient = SignalkClient.install();
  ...
  ...
} catch(e) {
  console.log(e);
}
```

### new SignalkClient(_host_, _port_[, debug_=false])

Creates and returns a new __SignalkClient__ instance and initiates an
asynchronous connection to the Signal K server at _host_:_port_.
The boolean _debug_ argument can be used to enable trace output to
console.log.

You probably don't want to use this constructor method: see
__install()__ above for the reasons why.

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
     console.log("Connected!");
     // Do other application stuff...
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

### getValue(_path_, _callback_[, filter_])

Get the current value of _path_ from the Signal K server, transform it
through _filter_ (if supplied) and process it in a way that depends on
the type of _callback_.

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

The following example updates the content of the DOM element identified
by an id attribute of 'tank-level' with the percentage level in the
waste tank. 
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
