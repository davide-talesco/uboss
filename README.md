# UBOSS

This module provides a light and non opinionated framework to authorize method execution. The basic idea is that you have 
a method that you want to expose behind authorization and some ACL that you want to configure on the method.

It also gives you the options to run a middleware functions pipeline 
# USAGE

First you initialize an UBOSS instance, then you load the ACL the methods and optionally some roles.

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

uboss.load({methods: 'doStuff'});
uboss.load({acl: acl});

uboss.exec({method: 'doStuff', metadata: {requestor: { roles: [ 'admin']}}}); // => true

uboss.exec({method: 'doStuff', metadata: {requestor: { roles: [ 'user']}}}); // => false
```

# ACL

ACL are bound to methods via their `method` or `methods` properties. ACL support 2 predicates `include` and `equal`.
There are 2 kind of acl: **attribute based**, for simple checks where we want two values or **role based** acl for more
complex rules.
 

## Attribute based ACL

There are 2 kind of attribute based acl: `attribute path to string` and `attribute path to attribute path`.
You compare a property of the metadata object (identified by its path in the metadata object structure)
with a string, or with another property of the metadata object (also identified by its path)

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

// acl bound to multiple methods
const acl = {
  methods: ['doStuff', 'otherStuff'],
  attribute: {
    path: 'requestor.roles',
    equal: 'admin'
  }
};

// this is the same as defining 2 attribute based acl
const acl = {
  method: 'doStuff',
  attributes: [{
    path: 'requestor.roles',
    equal: 'admin'
  }, {
    path: 'requestor.roles',
    equal: 'admin'
  }]
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

## ROLE based acl

If you need to define more complex acl you can use Roles. Roles are functions that should expect to receive as input
the metadata object and should return true or false.

```javascript
const UB = require('uboss');
const uboss = UB();

// role
function owner(metadata){
  return metadata.requestor.id === metadata.resource.owner && 
  metadata.requestor.roles.includes('admin');
};

const acl = {
  method: 'doStuff',
  role: 'owner'
};

// this should be like defining 2 role based acl
const acl = {
  method: 'doStuff',
  roles: ['owner', 'mayor']
};

uboss.load({methods: 'doStuff'});
uboss.load({acl: acl});
uboss.load({roles: owner});

uboss.exec({method: 'doStuff', metadata: {requestor: { id: 1, roles: [ 'admin']}}, resource: { owner: 1}}); // => true

uboss.exec({method: 'doStuff', metadata: {requestor: { id: 1, roles: [ 'admin']}}, resource: { owner: 3}}); // => false

```

Uboss will swallow any error thrown by the roles fn and return false instead.

## Result
The exec method always return true or false

## API

### LOAD

**Load Method** Accept an object as per below schemas

Property Name | Type | Required |  Default | Description
-------- | -------- | ----------- | -------- | ------- |
`methods` | string OR [] | **true** | N/A |  this is name of method || methods to load into uboss

**Load ACL** Accept an object as per below schemas

Property Name | Type | Required |  Default | Description
-------- | -------- | ----------- | -------- | ------- |
`acl` | acl Object OR [acl Object] | **true** | N/A |  this is the acl Object || a list of acl objects

**Load ROLES** Accept an object as per below schemas

Property Name | Type | Required |  Default | Description
-------- | -------- | ----------- | -------- | ------- |
`roles` | role Object OR [role Object] | **true** | N/A |  this is the role Object || a list of role objects