# UBOSS

This module provides an interface to declaratively defines your methods.

At its simplest form you simply pass a list of unary functions (functions should take a single `argument`, which throughout 
this document is called `request` ) and you get back an object that exposes those functions as methods that wraps the result
of the original method around a Promise.

Functions must either return a value, a Promise and can throw errors both synchronously and asynchronously.

```javascript
const U = require('uboss')();

const methods = {
  upper: data => data.toUpperCase(),
  lower: data => data.toLowerCase(),
  notUsed: data => data
};

// configure the methods you want to expose
const config = {
  methods: {
      upper: {},
      lower: {}
  }
};

// load available methods
U.load({ methods });

// load configuration
U.load({ config });

// build API
const API = U.compose();

API.upper('ciao').then(console.log); // => 'CIAO'
API.lower('ciao').then(console.log); // => 'ciao'
API.notUsed('ciao') // => Throw synchronously : TypeError: API.notUsed is not a function
API.nonExisting('ciao') // => Throw synchronously : TypeError: API.nonExisting is not a function
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
  methods: {
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
  }
};

// load middlewares
U.load({ middlewares });

// load available methods
U.load({ methods });

// load configuration
U.load({ config });

// build API
const API = U.compose();

API.upper('ciao').then(console.log); // => 'CIAOCIAO'
API.lower('ciao').then(console.log); // => 'ciaociao'
API.ciao('davide') // => 'hello'
```

## ACL

Uboss also provides an abstraction for defining ACL and protect a method behind it. The only assumption Uboss makes is
the incoming request object might have a metadata property (or a getMetadata method that returns the metadata object) 
which contains the data required to resolve ACL questions.

ACL are evaluated within the middleware pipeline: [beforeAuth, Auth, beforeInvoke, Method, afterInvoke].

You can leverage the special middleware phase **beforeAuth** to define middlewares that need to extend the metadata
object, by for example fetching additional information asynchronously.

### Usage

ACL are bound to methods via Uboss config:

```javascript
const config = {
  methods: {
      upper: {
        acl: {}
      }
  }
};
```

### ROLE based acl

At the moment the only supported ACL are ROLE based acl.
Roles functions will receive as input the request metadata object and should return true or false **synchronously**

Uboss will swallow any error thrown by the roles fn and return false instead.

```javascript
const U = require('uboss')();

const methods = {
  resetPassword: req => {} // do reset password stuff
};

const roles = {
  admin : metadata => metadata.requestor.roles.includes('admin')
};

// configure the methods you want to expose
const config = {
  methods: {
    resetPassword: {
      acl: {
        roles: ['admin']
      }
    },
  }
};

// load available roles
U.load({ roles });

// load available methods
U.load({ methods });

// load configuration
U.load({ config });

// build API
const API = U.compose();

API.resetPassword({ id:'user1', metadata: { requestor: { roles: ['admin'] }}}).then(console.log); // => ''
API.resetPassword({ id:'user1', metadata: { requestor: { roles: ['standard User'] }}}).catch(console.log); // => '403 Unauthorized'
```

You first load the roles, then you can reference them in the config.

**IMPORTANT**
In role Fn, when using the `===` operator always always check for undefined because in JS undefined === undefined is **true**

```javascript
// Wrong: if both metadata.requestor.dn and metadata.resource.manager are undefined this function return true
function owner(metadata){
  return metadata.requestor.dn === metadata.resource.manager;
}
// Right
function owner(metadata){
  return metadata.requestor.dn &&
    metadata.requestor.dn === metadata.resource.manager;
}
``` 