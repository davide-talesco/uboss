const stampit = require("@stamp/it");
const _ = require("lodash");
const assert = require("assert");

const METHODCONFIG = stampit({
  initializers : [
    // initialize middlewares
    function({ middlewares = {} }){

      const phases = ["beforeInvoke", "afterInvoke"];

      assert(_.isObjectLike(middlewares), "middlewares if set must be an object");

      this.middlewares = {};
      phases.map(phase => {
        this.middlewares[phase] = [];

        // if phase object exist validate and push its keys
        if (middlewares[phase]){
          // make sure phase is an array
          assert(
            _.isArray(middlewares[phase]),
            `${phase} middleware chain, if set, should be an array`
          );
          // validate and push each
          middlewares[phase].map(middleware => {

            assert(middleware, 'middlewares must be string');
            this.middlewares[phase].push(middleware)
          })
        }
      });
    }
  ]
});

const CONFIG = stampit({
  initializers: [
    function(config){
      // config should be an object
      assert(_.isObjectLike(config), "config must be an object");

      // each config key is a method
      Object.keys(config).map(method => {
        // initialize the method
        this[method] = METHODCONFIG(config[method]);
      })
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
      instance._config = {};
    }
  ],
  methods: {
    verify: verify,
    load: load,
    fetch: fetch
  }
});

// UBOSS METHODS
function load(o = {}) {
  if (o.methods) {
    // for each own property check is a function
    Object.keys(o.methods).map(name => {
      assert(
        typeof o.methods[name] === "function",
        `method ${name} must be a function`
      );
      // copy the method internally
      this._methods[name] = o.methods[name];
    });
  } else if (o.middlewares) {
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

function verify() {
  const config = this._config;
  const methods = this._methods;
  const middlewares = this._middlewares;

  // verify methods referenced in config are avaialble in uboss instance
  Object.keys(config).map(name => {
    // verify method is available
    assert(methods[name], `method ${name} has not been loaded`);

    // verify any referenced middlewares is available
    ["beforeInvoke", "afterInvoke"].map(phase => {

      // for each middleware referenced in config check it is avaialble in uboss instance
      config[name].middlewares[phase].map(mName => {
        assert(middlewares[mName], `middleware ${mName} has not been loaded`);
      });
    });
  });
}

function fetch(methodName) {
  const config = this._config;

  if (!this._config[methodName]) {
    throw new Error(`method ${methodName} has not been configured`);
  }
  // method to execute
  const method = this._methods[methodName];
  const middlewares = this._middlewares;

  // list of configured middlewares
  const beforeInvokeMiddlewares = config[methodName].middlewares.beforeInvoke.map(name => middlewares[name]);
  const afterInvokeMiddlewares = config[methodName].middlewares.afterInvoke.map(name => middlewares[name]);

  const pipeline = [
    ...beforeInvokeMiddlewares,
    method,
    ...afterInvokeMiddlewares
  ];

  return req =>
    new Promise((resolve, reject) => {

      // then a list of functions
      const compose = functions =>
        initialValue =>
          functions.reduce(
            (p, fn) => {
              return p.then(data => fn(data, resolve))
            },
            Promise.resolve(initialValue)
          );

      compose(pipeline)(Promise.resolve(req))
        .then(resolve)
        .catch(reject)

    });
}

module.exports = UBOSS;
