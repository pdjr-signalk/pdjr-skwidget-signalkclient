# signalk-client

Library providing a web-client application interface to SignalK

The signalk-client library implements the __SignalkClient__ class which
supports WebSocket connection to a Signal K server and provides methods
for programmatic and event driven access to the server's data paths.

Applications can extend the SignalkClient class using the following simple
pattern:
```
super(host, port).waitForConnection().then(_ => {
   // do application specific stuff
});
```

## Creating a connection object
```
var client = new SignalkClient(host, port[, options]);
```
Returns a new SignalkClient object, associating it with the Signal K server
identified by _host_:_port_.

The connection is attempted asynchronously and the constructor will inevitably
return before the putative connection is in a usable state. Users should use
the ```waitForConnection()``` method to manage this eventuality.

The _options_ object can be used to supply some additional configuration
properties:

options.debug: boolean value switching trace messaging on and off (default);

The waitForConnection([millis]) method returns a promise which will resolve
when a connection with the server identified by _host_:_port_ is established.
The frequency at which the connection is polled defaults to 500 milliseconds,
but this can be adjusted by supplying the optional _millis_ argument.

## Methods for event driven data access

The following methods allow the host application to register callback functions
which will be invoked each time a value on a defined Signal K path changes.

### registerCallback(path, callback[, filter])

Registers the function or object specified by _callback_ for invocation
when the data value on _path_ changes.  An optional _filter_ function can
be supplied which will be used to process values recovered from _path_
before they are forwarded to _callback_.

_path_ must specify the full path to a Signal K data value.  For example,
```tanks.wasteWater.0.currentLevel```.

_callback_ can be either a simple function or an object instance which
implements an ```update()``` method which will be used as _callback_.  In
either case, the supplied function should have the signature ```f(v)```:
when invoked _v_ will substituted with the value derived from _path_.

_filter_ is a function with the signature ```f(v) -> v'``` which will be
used to transform values derived from _path_.

Values returned from Signal K are processed in the following way.

1. The value is parsed into a JSON value.
2. If _filter_ is defined, then the JSON value is processed by _filter_
   and the result passed directly to _callback_.
3. Otherwise, if the JSON value is an object AND it contains a "value"
   attribute then the value of the value attribute is passed to _callback_.
4. Otherwise, the JSON value is passed to _callback_.

### registerInterpolation(path, element[, filter])

Is a simple wrapper for ```registerCallback()``` which uses a built-in
callback function to interpolate updates on the specified Signal K _path_
directly into the DOM as the HTML content of _element_. _filter_ can be
used to pass a filter function to ```registerCallback()```. 

## Methods for programmatic data access

The following methods recover a data value by making a synchronous or
asynchronous call to the Signal K server.

### getValue(path[, callback[, filter]])

Recovers the current value associated with server <path>.  If <filter> is
specified the recovered value is processed by the supplied function. If
<callback> is undefined or null, then getValue makes a synchronous call to
the server and the recovered value is returned as the function result. If a
<callback> is supplied, then an asynchronous call is made to the server and
the return value of getValue is undefined.
 
### interpolateValue(path, element[, filter[, getFilter]])

A convenience function which interpolates a <path> value recovered using
getFilter into the DOM as the HTML content of <element>. The recovered
value can be processed using a <filter> function and processing within
getValue can be implemented by specifying <getFilter>.
