const U = require('./index2')();

const roles = {
  admin: metadata => metadata.requestor === 'admin',
  user: metadata => metadata.requestor === 'user'
};

const methods = {
  increase: req => ++req.value
};

const config = {
  methods: {
    increase: {
      acl: {
        roles: ['admin', 'user']
      }
    }
  }
};

U.load({ roles });
U.load({ methods });
U.load({ config });

const API = U.compose();

const metadata = {
  requestor : 'admin'
};

const metadata2 = {
  requestor : 'user'
};

const metadata3 = {
  requestor : 'partner'
};

API.increase({ value: 1, metadata2 }).then(console.log);