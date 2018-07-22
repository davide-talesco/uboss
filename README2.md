# UBOSS

This module provides an interface to declaratively define your methods.

At its simplest form you simply pass a list of unary functions (functions should take a single argument, which throughout 
this document is caller request) and you get back an object that expose those functions as methods.

Functions must either return a value, a Promise and can throw errors both synchronously and asynchronously

```javascript
const U = require('uboss')();

const methods = {
  upper: data => data.toUpperCase(),
  lower: data => data.toLowerCase(),
  notUsed: data => data
};

// configure the methods you want to expose
const config = {
  upper: {},
  lower: {}
};

// load available methods
U.load({ methods });

// load configuration
U.load({ config });

// verify config is ok
U.verify();

U.fetch('upper')('ciao') // => 'CIAO'
U.fetch('lower')('ciao') // => 'ciao'
U.fetch('notUsed')('ciao') // => Error: method notUsed has not been configured;
U.fetch('nonExisting')('ciao') // => Error: method unknown has not been configured;

```

This is not very useful yet but it is the building block to provide additional capabilities.
Enter Middlewares.

Please Note **methods** are loaded by name, so if you load 2 methods with the same name the latter will be the one to be configured.

## Middlewares

You can define middlewares functions, load them into uboss and reference them within the config file to create a pipeline
of functions. 

There are 2 different middleware phases: **beforeInvoke** and **afterInvoke**, respectively executed before or after the method being invoked.
Clearly beforeInvoke middlewares should expect a Request argument as input while afterInvoke a Response argument.

Each Middleware can either modify the request/response and pass it along to the next function, throw an error that 
will be bubble up as is to the caller or interrupt the pipeline execution and return a value directly to the caller.

The first argument of a middleware will be the Request/Response, while the second argument is a function that can be used to 
interrupt the pipeline and optionally return a value to the caller.

Middlewares must either return a value, a Promise and can throw errors both synchronously and asynchronously

As each middleware return value will be fed as the next middleware input middlewares, like methods, middlewares must be unary functions.

Please Note **middlewares** are loaded by name, so if you load 2 middlewares with the same name the latter will be the one to be configured.

```javascript
const U = require('uboss')();

const methods = {
  upper: data => data.toUpperCase(),
  lower: data => data.toLowerCase(),
  notUsed: data => whatever(data),
  ciao: name => 'ciao ' + name
};

const middlewares = {
  duplicate: data => data + data,
  interrupt: (data, res) => res('hello')
};

// configure the methods you want to expose
const config = {
  upper: {
    middlewares: {
      beforeInvoke: [
        'duplicate'
      ]
    }
  },
  lower: {
    middlewares: {
      afterInvoke: [
        'duplicate'
      ]
    }
  },
  ciao: {
    middlewares:{
      beforeInvoke: [
        'interrupt'
      ]
    }
  }
};

// load middlewares
U.load({ middlewares });

// load available methods
U.load({ methods });

// load configuration
U.load({ config });

// verify config is ok
U.verify();

U.fetch('upper')('ciao') // => 'CIAOCIAO'
U.fetch('lower')('ciao') // => 'ciaociao'
U.fetch('ciao')('davide') // => 'hello'

```

The function returned by fetch will be a composition of middleware functions and the source function as per config.