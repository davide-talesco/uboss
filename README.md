# UBOSS

This module provides a light and non opinionated framework to authorize method execution. The basic idea is that you have 
a method that you want to expose behind authorization and some ACL that you want to configure on the method.

# USAGE

First you initialize an UBOSS instance, then you load the ACL and the methods.

You run the `ready` method to validate every method has at least one ACL bound to it.

You call the `exec` method passing a `UBOSS request object` that contains the name of the method to call and 
an optional metadata property which contains the data required to evaluate the ACL

UBOSS will evaluate each ACL associated to the method and if at least one is successful will call the 
method binding it with the original request arguments.

```javascript
const UB = require('uboss');
const uboss = UB();

const acl = {
  method: 'doStuff',
  attribute: {
    path: 'requestor.roles',
    include: 'admin'
  }
};

uboss.load({method: doStuff});
uboss.load({acl: acl});

uboss.exec({method: 'doStuff', metadata: {requestor: { roles: [ 'admin']}}}); // => true

uboss.exec({method: 'doStuff', metadata: {requestor: { roles: [ 'user']}}}); // => false

function doStuff(){
  // ...
}
```

# ACL

ACL are bound to methods via their `method` or `methods` properties. 

## Attribute/String based acl

```javascript

// attribute based to string
const acl = {
  method: 'doStuff',
  attribute: {
    path: 'requestor.roles',
    include: 'admin'
  }
};


const acl = {
  method: 'doStuff',
  attribute: {
    path: 'requestor.roles',
    equal: 'admin'
  }
};
```

## Attribute/Attribute based acl

```javascript
const acl = {
  method: 'doStuff',
  attribute: {
    path: 'requestor.id',
    include: {
      path: 'resource.owner'
    }
  }
};
```

## Errors
The exec method return an **Unauthorized** error with **statusCode** === 401 whenever the method invocation is not allowed.