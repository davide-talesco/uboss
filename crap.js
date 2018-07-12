const UB = require('./index');

const acl = {
  method: 'increase',
  attribute: {
    path: 'requestor.tags',
    include: 'admin'
  }
};

const metadata = {
  requestor : {
    tags: ['admin', 'internal']
  }
}

const uboss = UB();
uboss.load({method: 'increase'});
uboss.load({acl: acl});
uboss.ready();

console.log(uboss.exec({ method: 'increase', metadata}))

