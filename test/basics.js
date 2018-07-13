/**
 * Created by davide_talesco on 13/6/18.
 * This file contains the unit tests of paip
 */

'use strict';
const _ = require('lodash');
const UB = require('../index');
const Lab = require('lab');
const { expect } = require('code');

// Test files must require the lab module, and export a test script
const lab = (exports.lab = Lab.script());

// shortcuts to functions from lab
const experiment = lab.experiment;
const test = lab.test;

experiment('test load ', () => {

  test('valid method', () =>{
    const uboss = UB();
    uboss.load({method: 'method1'});
    expect(uboss.methods('method1')).to.be.equal('method1')
  });

  test('valid acl', () =>{
    const uboss = UB();
    const acl = {
      method: 'method',
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    uboss.load({acl: acl});
    expect(uboss.acl().length).to.be.equal(1)
  });

  test('valid role', () =>{
    const uboss = UB();

    function owner(){

    }
    uboss.load({role: owner});
    expect(uboss.roles('owner').name).to.be.equal('owner')
  });

  test('unknown object type', () =>{
    const uboss = UB();
    const acl = {
      method: 'method',
      attribute: {
        path: 'requestor.tags',
      }
    };

    expect(() => uboss.load({whatever: acl}))
      .to.throw('Unsupported load options');
  });

});

experiment('test load methods: ', () => {

  test('already existing method should throw', () =>{
    const uboss = UB();
    uboss.load({method: 'method1'});
    expect(() => uboss.load({method: 'method1'}))
      .to.throw('method names must be unique');
  });

  test('malformed method is not a string should throw', () =>{
    const uboss = UB();
    expect(() => uboss.load({method: { an: 'object'}}))
      .to.throw('method must be a string');
  });

});

experiment('test load acl', () => {

  test('load malformed attribute based acl missing predicate', () =>{
    const uboss = UB();
    const acl = {
      method: 'method',
      attribute: {
        path: 'requestor.tags',
      }
    };

    expect(() => uboss.load({acl: acl}))
      .to.throw('exactly one predicate of include, equal must exist in ACL_ATTRIBUTE object');
  });

  test('malformed attribute/attribute based acl with no path property', () =>{
    const uboss = UB();
    const acl = {
      method: 'increase',
      attribute: {
        path: 'id',
        equal: {
          'whatever': 'resource.owner'
        }
      }
    };

    expect(() => uboss.load({acl: acl}))
      .to.throw('the value of the predicate of an ACL_ATTRIBUTE object must be either a string or an object with a path property whose type must be string');
  });

  test('malformed attribute/attribute based acl with typeof predicate.path prop !== string', () =>{
    const uboss = UB();
    const acl = {
      method: 'increase',
      attribute: {
        path: 'id',
        equal: {
          'path': {name: 'resource.owner'}
        }
      }
    };

    expect(() => uboss.load({acl: acl}))
      .to.throw('the value of the predicate of an ACL_ATTRIBUTE object must be either a string or an object with a path property whose type must be string');
  });

});

experiment('test load roles', () => {

  test('load malformed role that is not a function', () =>{
    const uboss = UB();

    expect(() => uboss.load({role: {}}))
      .to.throw('role must be a function');
  });

  test('load duplicate role', () =>{
    const uboss = UB();
    function owner(){
    }

    uboss.load({role: owner});
    expect(() => uboss.load({role: owner}))
      .to.throw('roles must be unique');
  });

});

experiment('test ready', ()=>{

  test('no method', () => {
    const uboss = UB();
    uboss.ready()
  });

  test('valid method', () =>{
    const uboss = UB();
    const acl = {
      method: 'method',
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    uboss.load({method: 'method'});
    uboss.load({acl: acl});
    uboss.ready()
  });

  test('method missing acl should throw', () =>{
    const uboss = UB();
    const acl = {
      method: 'method',
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    uboss.load({method: 'method'});
    uboss.load({method: 'method1'});
    uboss.load({method: 'method1b'});
    uboss.load({acl: acl});
    expect(() => uboss.ready()).to.throw('unprotected Method: ["method1","method1b"]');
  });

  test('acl bound to multiple methods', () =>{
    const uboss = UB();

    const acl = {
      methods: ['method', 'method1'],
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    uboss.load({method: 'method'});
    uboss.load({method: 'method1'});
    uboss.load({acl: acl});
    uboss.ready()
  });

  test('acl referencing valid role', () => {
    const uboss = UB();
    const acl = { method: 'login', role: 'owner'};
    function owner(){};

    uboss.load({role: owner});
    uboss.load({acl: acl});
    uboss.ready()
  });

  test('acl referencing non existing role should throw', () => {
    const uboss = UB();
    const acl = { method: 'login', role: 'owner'};

    uboss.load({acl: acl});
    expect(() => uboss.ready())
      .to.throw('unknown Roles: ["owner"]');
  });
});

experiment('test exec attribute based acl', () => {

  test('include predicate', () => {
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

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(true);

  });

  test('equal predicate', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    const metadata = {
      requestor : {
        tags: 'admin'
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(true);

  });

  test('include predicate, not authorized', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    const metadata = {
      requestor: {
        tags: ['other', 'internal']
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

  test('equal predicate, not authorized', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.tags',
        equal: 'admin'
      }
    };

    const metadata = {
      requestor : {
        tags: 'user'
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

  test('include predicate on non array property', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.tags',
        include: 'admin'
      }
    };

    const metadata = {
      requestor: {
        tags: 'pippo'
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

  test('equal predicate on non string property', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.tags',
        equal: 'admin'
      }
    };

    const metadata = {
      requestor: {
        tags: ['admin']
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

  test('non existing attribute path', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.whatever',
        equal: 'admin'
      }
    };

    const metadata = {
      requestor: {
        tags: ['admin']
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

  test('attribute/attribute based ACL', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.id',
        equal: {
          'path': 'resource.owner'
        }
      }
    };

    const metadata = {
      requestor : {
        id: 123,
        tags: ['admin', 'internal']
      },
      resource :  {
        owner: 123
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata })).to.be.equal(true);
  })

  test('non existing method', () => {
    const acl = {
      method: 'increase',
      attribute: {
        path: 'requestor.whatever',
        equal: 'admin'
      }
    };

    const metadata = {
      requestor: {
        tags: ['admin']
      }
    };

    const uboss = UB();
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(() => uboss.exec({ method: 'unknown', metadata})).to.throw('method unknown does not exists');

  });

});

experiment('test exec role based acl', () => {

  test('matching role', () => {
    const acl = {
      method: 'increase',
      role: 'admin'
    };

    function admin(metadata){
      return metadata.requestor.id === metadata.resource.owner;
    }

    const metadata = {
      requestor : {
        id: 1,
        tags: ['admin', 'internal']
      },
      resource: {
        owner: 1
      }
    }

    const uboss = UB();
    uboss.load({role: admin});
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(true);

  });

  test('non matching role should return false', () => {
    const acl = {
      method: 'increase',
      role: 'admin'
    };

    function admin(metadata){
      return metadata.requestor.id === metadata.resource.owner;
    }

    const metadata = {
      requestor : {
        id: 1,
        tags: ['admin', 'internal']
      },
      resource: {
        owner: 3
      }
    }

    const uboss = UB();
    uboss.load({role: admin});
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

  test('role throws an error synchronously should return false', () => {
    const acl = {
      method: 'increase',
      role: 'admin'
    };

    function admin(metadata){
      return metadata.error.id === metadata.error.owner;
    }

    const metadata = {
      requestor : {
        id: 1,
        tags: ['admin', 'internal']
      },
      resource: {
        owner: 1
      }
    };

    const uboss = UB();
    uboss.load({role: admin});
    uboss.load({method: 'increase'});
    uboss.load({acl: acl});
    uboss.ready();

    expect(uboss.exec({ method: 'increase', metadata})).to.be.equal(false);

  });

});