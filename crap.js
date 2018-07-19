const UB = require('./index');

const acl = {
  method: 'increase',
  attributes: [{
    path: 'requestor.tags',
    include: 'admin'
  }, {
    path: 'requestor.tags',
    include: 'user'
  }]
};

const metadata1 = {
  requestor: {
    tags: ['admin', 'user']
  }
};

const metadata2 = {
  requestor: {
    tags: ['user']
  }
};

const metadata3 = {
  requestor: {
    tags: ['something else']
  }
};

const uboss = UB();
uboss.load({methods: 'increase'});
uboss.load({acl: acl});
uboss.ready();

console.log(uboss.exec({ method: 'increase', metadata: metadata1}))