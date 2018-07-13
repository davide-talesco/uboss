const stampit = require("@stamp/it");
const R = require('ramda');
const _ = require('lodash');
const assert = require('assert');

const ACL_ATTRIBUTE = stampit({
  initializers: [
    function ({ path, include, equal }){
      this.path = path;
      include ? this.predicate = 'include' : equal ? this.predicate = 'equal' : '';
      this.value = include || equal;

      assert(path, "path must exist in ACL_ATTRIBUTE object");
      assert(this.predicate, "exactly one predicate of include, equal must exist in ACL_ATTRIBUTE object");
      assert(this.value, "the value of the predicate object must exist in ACL_ATTRIBUTE object");

      // verify that this.value is either a string or an object with a path property
      assert(typeof this.value === 'string' ||
        (this.value.path &&
         typeof this.value.path === 'string'),
        "the value of the predicate of an ACL_ATTRIBUTE object must be either a string or an object with a path property whose type must be string");
    }
  ],
  methods: {
    evaluate : function (metadata = {}) {
      // ACL have subject, value and a predicate
      const subject = R.path(this.path.split('.'), metadata);
      // value might be a string or an object with a path property
      const value = typeof this.value === 'string' ? this.value : R.path(this.value.path.split('.'), metadata);

      try{
        switch(this.predicate) {
          case 'include':
            return subject.includes(value);
            break;
          case 'exlcude':
            return !subject.includes(value);
            break;
          case 'equal':
            return subject === value;
            break;
          default:
            return false
        }
      }
      catch(e){
        return false;
      }
    }
  }
});

const ROLE_BASED_ACL = stampit({
  initializers: [
    function ({ role }){
      if (role) {
        this.role = role;
        this.kind = 'role';
        // override ACL evaluate method with attribute based method evaluation
        this.evaluate = metadata => this.attribute.evaluate.call(this.attribute, metadata)
      };
    }
  ]
});

const ATTRIBUTE_BASED_ACL = stampit({
  initializers: [
    function ({ attribute }){
      if (attribute) {
        this.attribute = ACL_ATTRIBUTE(attribute);
        // override ACL evaluate method with attribute based method evaluation
        this.evaluate = metadata => this.attribute.evaluate.call(this.attribute, metadata)
      };
    }
  ]
});

const ACL = stampit({
  initializers: [
    function ({ method, methods }){
      if (method) this.methods = _.castArray(method);
      if (methods) this.methods = _.castArray(methods);

      assert(this.methods, "method || methods must exist in ACL object");
    }
  ]
}).compose(ATTRIBUTE_BASED_ACL)
  .compose(ROLE_BASED_ACL);

const UBOSS = stampit({
  initializers: [
    function ({}, { instance }) {
      // initialize the methods list
      instance._methods = [];

      // initialize the acl list
      instance._acl = [];

      // initialize the roles list
      instance._roles = [];
    },
  ],
  methods:{
    load: function load(options = {}){
      if (options.method){

        assert(typeof options.method === 'string', "method must be a string");
        assert(!R.find(R.equals(options.method), this._methods), 'method names must be unique');

        // push the method to this instance methods object
        this._methods.push(options.method);
      }
      else if (options.acl){
        // initialize method
        const acl = ACL(options.acl);
        // push the method to this instance method list
        this._acl.push(acl);
      }
      else if (options.role){
        // initialize method
        assert(typeof options.role === 'function', "role must be a function");
        assert(!R.find(R.equals(options.role.name), this._roles.map(r => r.name)), 'roles must be unique');
        // push the method to this instance method list
        this._roles.push(options.role);
      }
      else {
        throw new Error('Unsupported load options')
      }
    },
    ready: function ready(){

      // check that for each method there is at least one acl
      const unprotectedMethods = this._methods
        .filter(m => R.any(acl => {
          return !acl.methods.includes(m)
        }, this._acl));

      if (unprotectedMethods.length > 0){
        throw new Error(`unprotected Method: ${JSON.stringify(unprotectedMethods)}`)
      }

      // check that for each role acl there is a registered role
      const unknownRoles = this._acl
        .filter(acl => acl.kind === 'role')
        .map(acl => acl.role)
        .filter(acl => !this._roles.includes(acl.role));

      if (unknownRoles.length > 0){
        throw new Error(`unknown Roles: ${JSON.stringify(unknownRoles)}`)
      }
    },
    exec: function exec(req = {}){

      const method = req.method;

      assert(method, 'Request must have a method property');
      assert(R.find(R.equals(method), this._methods), `method ${method} does not exists`);

      // evaluate all ACL and return true if at least one acl evaluated true
      return this.acl(method)
        .map(acl => acl.evaluate(req.metadata))
        .reduce((acc, currentValue) => acc || currentValue, false);
    },
    methods: function methods( name ){
      if (name) return R.clone(R.find(R.equals(name), this._methods));
      return R.clone(this._methods);
    },
    acl: function acl( methodName ){
      if (methodName)
        return R.clone(R.filter( acl => acl.methods.includes(methodName), this._acl));
      return R.clone(this._acl);
    },
    roles: function roles( name ){
      if (name)
        return R.clone(R.filter( r => r === name, this._roles.map(r => r.name)));
      return R.clone(this._roles);
    }
  }
});

module.exports = UBOSS;