const U = require('./index2')();

U.load({ methods: { upper: data => data.toUpperCase() } });

const config = {
  upper: {
    middlewares: {
      beforeInvoke: {}
    }
  }
};

// load configuration
U.load({ config });

// verify config is ok
U.verify()