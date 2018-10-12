/**
 * Created by davide_talesco on 13/6/18.
 * This file contains the unit tests of paip
 */

"use strict";
const _ = require("lodash");
const uboss = require("../index");
const Lab = require("lab");
const { expect, fail } = require("code");
const EE = require('events').EventEmitter;
const sinon = require('sinon');
const util = require('util');
const nextTickAsync = util.promisify(process.nextTick);

// Test files must require the lab module, and export a test script
const lab = (exports.lab = Lab.script());

// shortcuts to functions from lab
const experiment = lab.experiment;
const test = lab.test;

experiment("load", () => {
  test("method not a function should throw", () => {
    const U = uboss();

    const methods = {
      test: "pippo"
    };

    expect(() => U.load({ methods })).to.throw(
      "method test must be a function"
    );
  });

  test("2 methods with same name, last wins", async () => {
    const U = uboss();
    const config = {
      methods: {
        test: {}
      }
    };
    // load available methods
    U.load({ methods: { test: () => 1 } });
    U.load({ methods: { test: () => 2 } });
    // load configuration
    U.load({ config });
    // compose API
    const API = U.compose();
    expect(await API.test()).to.be.equal(2);
  });

  test("middleware not a function should throw", () => {
    const U = uboss();

    const middlewares = {
      test: "pippo"
    };

    expect(() => U.load({ middlewares })).to.throw(
      "middleware test must be a function"
    );
  });

  test("2 middlewares with same name, last wins", async () => {
    const U = uboss();
    const config = {
      methods: {
        test: {
          middlewares: { beforeInvoke: ["test"] }
        }
      }
    };
    U.load({ middlewares: { test: () => 1 } });
    U.load({ middlewares: { test: () => 2 } });

    U.load({ methods: { test: data => data } });
    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.test()).to.be.equal(2);
  });

  test("config with a malformed middleware should throw", () => {
    const U = uboss();
    U.load({ methods: { upper: data => data.toUpperCase() } });

    const config = {
      methods: {
        upper: {
          middlewares: {
            beforeInvoke: {}
          }
        }
      }
    };

    // load configuration
    expect(() => U.load({ config })).to.throw(
      "beforeInvoke middleware chain, if set, should be an array"
    );
  });

  test("role not a function should throw", () => {
    const U = uboss();

    const roles = {
      test: "pippo"
    };

    expect(() => U.load({ roles })).to.throw(
      "role test must be a function"
    );
  });

  test("2 roles with same name, last wins", async () => {
    const U = uboss();
    const config = {
      methods: {
        test: {
          acl: {
            roles: ['test']
          }
        }
      }
    };
    U.load({ roles: { test: () => false } });
    U.load({ roles: { test: () => true } });

    U.load({ methods: { test: data => data } });
    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.test(2)).to.be.equal(2);
  });

});

experiment("compose", () => {
  test("config referencing not loaded role should throw", () => {
    const U = uboss();
    U.load({ methods: { upper: ()=> 1}})
    const config = {
      methods: {
        upper: {
          acl: {
            roles: ['admin']
          }
        }
      }
    };

    // load configuration
    U.load({ config });

    expect(() => U.compose()).to.throw("role admin has not been loaded");
  });

  test("config referencing not loaded method should throw", () => {
    const U = uboss();

    const config = {
      methods: {
        upper: {}
      }
    };

    // load configuration
    U.load({ config });

    expect(() => U.compose()).to.throw("method upper has not been loaded");
  });

  test("config referencing not loaded middleware should throw", () => {
    const U = uboss();
    U.load({ methods: { upper: data => data.toUpperCase() } });
    const config = {
      methods: {
        upper: {
          middlewares: {
            beforeInvoke: ["nonExisting"]
          }
        }
      }
    };

    // load configuration
    U.load({ config });
    expect(() => U.compose()).to.throw("middleware nonExisting has not been loaded");

  });
});

experiment("exec method", () => {

  test("non configured method should throw", () => {
    const U = uboss();
    const API = U.compose();

    expect(() => API.whatever()).to.throw(
      "API.whatever is not a function"
    );
  });

  test("value returning", async () => {
    const U = uboss();
    const methods = {
      upper: data => data.toUpperCase()
    };
    const config = {
      methods: {
        upper: {}
      }
    };
    // load available methods
    U.load({ methods });
    // load configuration
    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.upper("ciao")).to.be.equal("CIAO");
  });

  test("promise returning", async () => {
    const U = uboss();
    const methods = {
      upper: data =>
        new Promise(resolve =>
          setTimeout(() => resolve(data.toUpperCase()), 10)
        )
    };
    const config = {
      methods: {
        upper: {}
      }
    };
    // load available methods
    U.load({ methods });
    // load configuration
    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.upper("ciao")).to.be.equal("CIAO");
  });

  test("with value returning beforeInvoke middleware", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"]
          }
        }
      }
    };
    U.load({ methods: { increase: num => ++num } });

    U.load({ middlewares: { increase: num => ++num } });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(3);
  });

  test("afterInvoke middleware should be called with request and response", async () => {
    const U = uboss();
    const E = new EE();

    const spy = sinon.spy();
    E.on('called', spy);
    
    const config = {
      methods: {
        increase: {
          middlewares: {
            afterInvoke: ["log"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({ 
      middlewares: { 
        // afterInvoke should be called with the request and the response
        log: (req, res) => {
          E.emit('called', req, res);
        } 
      } 
    });
    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(2);

    // we need to wait next tick in order for afterInvoke middleware to execute
    await nextTickAsync();

    // the request should be 1
    expect(spy.args[0][0]).to.be.equal(1)
    // the response should be 2
    expect(spy.args[0][1]).to.be.equal(2)

  });

  // this means that if request is modified during the middleware pipeline afterInvoke will receive the modified request
  test("afterInvoke middleware should be called with the same request object method was called", async () => {
    const U = uboss();
    const E = new EE();

    const spy = sinon.spy();
    E.on('called', spy);
    
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["log"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({ 
      middlewares: {
        increase: num => ++num,
        // afterInvoke should be called with the request and the response
        log: (req, res) => {
          E.emit('called', req, res);
        } 
      } 
    });
    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(3);

    // we need to wait next tick in order for afterInvoke middleware to execute
    await nextTickAsync();

    // the request should be 1
    expect(spy.args[0][0]).to.be.equal(2)
    // the response should be 2
    expect(spy.args[0][1]).to.be.equal(3)

  });

  test("with promise returning middleware", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"]
          }
        }
      }
    }

    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          return new Promise(resolve => {
            setTimeout(() => resolve(++num), 10);
          });
        }
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(3);
  });

  test(" multiple middlewares on the same chain", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase", "decrease"],
          }
        }
      }
    };
    U.load({ methods: { increase: num => ++num } });

    U.load({ middlewares: { increase: num => ++num, decrease: num => --num } });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(2);
  });

  test("with middleware that throws synchronously", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    };
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          throw new Error("sync Error");
        }
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    await API.increase("ciao")
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("sync Error");
      });
  });

  test("middleware that throws synchronously with statusCode", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    };
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          const err = new Error("sync Error");
          err.statusCode = 400;
          throw err;
        }
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    await API.increase("ciao")
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("sync Error");
        expect(e.statusCode).to.be.equal(400);
      });
  });

  test("middleware that reject asynchronously", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              const err = new Error("async Error");
              err.statusCode = 400;
              reject(err);
            }, 10);
          });
        }
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    await API.increase("ciao")
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("async Error");
        expect(e.statusCode).to.be.equal(400);
      });
  });

  test("middleware that throws asynchronously, (this should never happen right?)", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              const err = new Error("async Error");
              err.statusCode = 400;
              throw err;
            }, 10);
          });
        }
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    await API.increase("ciao")
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("async Error");
        expect(e.statusCode).to.be.equal(400);
      });
  });

  test("with beforeInvoke middleware that interrupts the chain", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: (num, res) => {
          res(num + 10);
        }
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(11);
  });

  // this is actually taking longer just because the slowFn is still being run but syncronously but what matters is that 
  // API.increase does not wait for it
  test("does not wait for long running asynchronous afterInvoke middleware", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            afterInvoke: ["slowFn"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        slowFn: () => new Promise((res)=> {
          _.range(5000000).map(n => n);
          res();
        })
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(2);
  });

  // this is actually taking longer just because the slowFn is still being run but syncronously but what matters is that 
  // API.increase does not wait for it
  test("does not wait for long running synchronous afterInvoke middleware", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            afterInvoke: ["slowFn"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        slowFn: () => _.range(5000000).map(n => n)
      }
    });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(2);
  });

  test('with allowed role base acl', async () => {
    const U = uboss();

    const roles = {
      admin: metadata => metadata.requestor === 'admin'
    };

    const methods = {
      increase: req => ++req.value
    };

    const config = {
      methods: {
        increase: {
          acl: {
            roles: ['admin']
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

    expect(await API.increase({ value: 1, metadata })).to.be.equal(2);

  });

  test('with not allowed role based acl should throw', async () => {
    const U = uboss();

    const roles = {
      admin: metadata => metadata.requestor === 'admin'
    };

    const methods = {
      increase: req => ++req.value
    };

    const config = {
      methods: {
        increase: {
          acl: {
            roles: ['admin']
          }
        }
      }
    };


    U.load({ roles });
    U.load({ methods });
    U.load({ config });

    const API = U.compose();

    const metadata = {
      requestor : 'user'
    };

    await API.increase({ value: 1, metadata })
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("Unauthorized");
        expect(e.statusCode).to.be.equal(403);
      });

  });

  test('role throws an error synchronously should return Unauthorized', async () => {
    const U = uboss();

    const roles = {
      admin: metadata => metadata.requestor.error.unknown === 'admin'
    };

    const methods = {
      increase: req => ++req.value
    };

    const config = {
      methods: {
        increase: {
          acl: {
            roles: ['admin']
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

    await API.increase({ value: 1, metadata })
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("Unauthorized");
        expect(e.statusCode).to.be.equal(403);
      });

  });

  test('multi role acl', async () => {
    const U = uboss();

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

    //expect(await API.increase({ value: 1, metadata })).to.be.equal(2);
    expect(await API.increase({ value: 1, metadata: metadata2 })).to.be.equal(2);
    await API.increase({ value: 1, metadata: metadata3 })
      .then(() => fail("should not execute this"))
      .catch(e => {
        expect(e).to.be.an.error("Unauthorized");
        expect(e.statusCode).to.be.equal(403);
      });
  });

});
