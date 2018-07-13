const UB = require('./index');

const uboss = UB();
const acl = { method: 'login', role: 'owner'}

uboss.load({acl: acl});
uboss.ready()

