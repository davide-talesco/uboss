const stampit = require("@stamp/it");
const _ = require("lodash");
const assert = require("assert");

const ACL = stampit({
  initializers: [
    // initialize role based acl
    function({ roles = [] }) {
      this.roles = [];

      assert(_.isArray(roles), "acl.roles if set must be an array");

      roles.map(role => {
        assert(_.isString(role), "acl.roles.role must be a string");

        this.roles.push(role);
      });
    }
  ],
  methods: {
    compose: function({ roles }) {
      // pick list of roleFn mapped to this acl
      const roleFnList = this.roles.map(role => roles[role]);
      // if no roles have been provided there is nothing to authorize
      if (roleFnList.length === 0){
        return () => true;
      }
      // return a function that takes a metadata object and return true or false
      return metadata =>
        roleFnList
          .map(roleFn => {
            try {
              return roleFn(metadata);
            } catch (e) {
              return false;
            }
          })
          .reduce((acc, currValue) => acc || currValue, false);
    }
  }
});

const METHOD = stampit({
  initializers: [
    // initialize middlewares
    function({ middlewares = {} }) {
      const phases = ["beforeAuth", "beforeInvoke", "afterInvoke"];

      assert(_.isObject(middlewares), "middlewares if set must be an object");

      this.middlewares = {};
      phases.map(phase => {
        this.middlewares[phase] = [];

        // if phase object exist validate and push its keys
        if (middlewares[phase]) {
          // make sure phase is an array
          assert(
            _.isArray(middlewares[phase]),
            `${phase} middleware chain, if set, should be an array`
          );
          // validate and push each
          middlewares[phase].map(middleware => {
            assert(middleware, "middlewares must be string");
            this.middlewares[phase].push(middleware);
          });
        }
      });
    },
    // initialize acl
    function({ acl = {} }) {
      assert(_.isObject(acl), "acl if set must be an object");

      this.acl = ACL(acl);
    }
  ]
});

const CONFIG = stampit({
  // initialize config methods
  initializers: [
    function({ methods = {} }) {
      this.methods = {};
      // config should be an object
      assert(_.isObject(methods), "config methods property must be an object");

      // each config key is a method
      Object.keys(methods).map(method => {
        // initialize the method
        this.methods[method] = METHOD(methods[method]);
      });
    }
  ]
});

const UBOSS = stampit({
  initializers: [
    function({}, { instance }) {
      // initialize the available methods object
      instance._methods = {};

      // initialize the available middlewares object
      instance._middlewares = {};

      // initialize the config object
      instance._config = CONFIG();

      // initialize roles
      instance._roles = {};
    }
  ],
  methods: {
    compose: compose,
    load: load
  }
});

// UBOSS METHODS
function load(o = {}) {
  if (o.methods) {
    assert(_.isObject(o.methods), "methods should be an object");
    // for each own property check is a function
    Object.keys(o.methods).map(name => {
      assert(
        typeof o.methods[name] === "function",
        `method ${name} must be a function`
      );
      // copy the method internally
      this._methods[name] = o.methods[name];
    });
  } else if (o.roles) {
    assert(_.isObject(o.roles), "roles should be an object");
    // for each own property check is a function
    Object.keys(o.roles).map(name => {
      assert(
        typeof o.roles[name] === "function",
        `role ${name} must be a function`
      );
      // copy the method internally
      this._roles[name] = o.roles[name];
    });
  } else if (o.middlewares) {
    assert(_.isObject(o.middlewares), "middlewares should be an object");
    // for each own property check is a function
    Object.keys(o.middlewares).map(name => {
      assert(
        typeof o.middlewares[name] === "function",
        `middleware ${name} must be a function`
      );
      // clone the middleware internally
      this._middlewares[name] = o.middlewares[name];
    });
  } else if (o.config) {
    this._config = CONFIG(o.config);
  } else {
    throw new Error("Unsupported load options");
  }
}

function compose() {
  const config = this._config;
  const methods = this._methods;
  const middlewares = this._middlewares;
  const roles = this._roles;

  // verify methods referenced in config are avaialble in uboss instance
  Object.keys(config.methods).map(name => {
    // verify method is available
    assert(methods[name], `method ${name} has not been loaded`);

    // verify any referenced middlewares is available
    ["beforeAuth", "beforeInvoke", "afterInvoke"].map(phase => {
      // for each middleware referenced in config check it is avaialble in uboss instance
      config.methods[name].middlewares[phase].map(mName => {
        assert(middlewares[mName], `middleware ${mName} has not been loaded`);
      });
    });

    // verify any referenced role is available in uboss instance
    config.methods[name].acl.roles.map(roleName => {
      assert(roles[roleName], `role ${roleName} has not been loaded`);
    });
  });

  // initialize API object
  const API = {};

  // Setup API methods
  Object.keys(config.methods).map(methodName => {
    // pick method to execute
    const method = methods[methodName];

    // pick acl list
    const acl = config.methods[methodName].acl;

    // build auth method
    const auth = req => {
      // perform acl evaluation
      const allowed = acl.compose({ roles })(req.metadata);

      if (allowed) return req;

      const err = new Error("Unauthorized");
      err.statusCode = 403;

      throw err;
    };

    // pick configured middlewares
    const beforeAuthMiddlewares = config.methods[
      methodName
    ].middlewares.beforeAuth.map(name => middlewares[name]);
    const beforeInvokeMiddlewares = config.methods[
      methodName
    ].middlewares.beforeInvoke.map(name => middlewares[name]);
    const afterInvokeMiddlewares = config.methods[
      methodName
    ].middlewares.afterInvoke.map(name => middlewares[name]);

    // build the ordered function pipeline
    const pipeline = [
      ...beforeAuthMiddlewares,
      auth,
      ...beforeInvokeMiddlewares,
      method,
      ...afterInvokeMiddlewares
    ];

    // build the composed function
    const fn = (req = {}) =>
      new Promise((resolve, reject) => {
        // then a list of functions
        const compose = functions => initialValue =>
          functions.reduce((p, fn) => {
            return p.then(data => fn(data, resolve));
          }, Promise.resolve(initialValue));

        compose(pipeline)(Promise.resolve(req))
          .then(resolve)
          .catch(reject);
      });

    // set the function on the API
    API[methodName] = fn;
  });

  return API;
}

module.exports = UBOSS;
