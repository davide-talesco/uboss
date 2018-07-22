/**
 * Created by davide_talesco on 13/6/18.
 * This file contains the unit tests of paip
 */

"use strict";
const _ = require("lodash");
const uboss = require("../index2");
const Lab = require("lab");
const { expect, fail } = require('code');

// Test files must require the lab module, and export a test script
const lab = (exports.lab = Lab.script());

// shortcuts to functions from lab
const experiment = lab.experiment;
const test = lab.test;

experiment('fetch', () => {

  test("non configured method should throw", () => {
    const U = uboss();

    expect(() => U.fetch("whatever")("ciao")).to.throw(
      "method whatever has not been configured"
    );
  });

  test("non existing method should throw", () => {
    const U = uboss();
    expect(() => U.fetch("unknown")("ciao")).to.throw(
      "method unknown has not been configured"
    );
  });
});

experiment('load', ()=> {

  test("method not a function should throw", () => {
    const U = uboss();

    const methods = {
      test: "pippo"
    };

    expect(() => U.load({ methods })).to.throw(
      "method test must be a function"
    );
  });

  test("2 methods with same name", async () => {
    const U = uboss();
    const config = {
      test: {}
    };
    // load available methods
    U.load({ methods: { test: () => 1 } });
    U.load({ methods: { test: () => 2 } });
    // load configuration
    U.load({ config });
    // verify config is ok
    U.verify();
    expect(await U.fetch("test")()).to.be.equal(2);
  });

  test("middleware that is not a function should throw", () => {
    const U = uboss();

    const middlewares = {
      test: "pippo"
    };

    expect(() => U.load({ middlewares })).to.throw(
      "middleware test must be a function"
    );
  });

  test("2 middlewares with same name", async () => {
    const U = uboss();

    U.load({ middlewares: { test: () => 1 } });
    U.load({ middlewares: { test: () => 2 } });

    U.load({ methods: { test: data => data } });
    U.load({ config: { test: { middlewares:{ beforeInvoke: [ 'test' ]}} } });

    U.verify();
    expect(await U.fetch("test")()).to.be.equal(2);
  });
});

experiment('verify', ()=> {

  test("config referencing not loaded method should throw", () => {
    const U = uboss();

    const config = {
      upper: {}
    };

    // load configuration
    U.load({ config });

    // verify config is ok
    expect(() => U.verify()).to.throw("method upper has not been loaded");
  });

  test("config with a malformed middleware should throw", () => {
    const U = uboss();
    U.load({ methods: { upper: data => data.toUpperCase() } });

    const config = {
      upper: {
        middlewares: {
          beforeInvoke: {}
        }
      }
    };

    // load configuration
    expect(() => U.load({ config })).to.throw(
      "beforeInvoke middleware chain, if set, should be an array"
    );
  });

  test("config referencing a not loaded middleware should throw", () => {
    const U = uboss();
    U.load({ methods: { upper: data => data.toUpperCase() } });
    const config = {
      upper: {
        middlewares: {
          beforeInvoke: ["nonExisting"]
        }
      }
    };

    // load configuration
    U.load({ config });

    // verify config is ok
    expect(() => U.verify()).to.throw("middleware nonExisting has not been loaded");
  });

});

experiment('exec method', ()=> {

  test("value returning", async () => {
    const U = uboss();
    const methods = {
      upper: data => data.toUpperCase(),
    };
    const config = {
      upper: {}
    };
    // load available methods
    U.load({ methods });
    // load configuration
    U.load({ config });
    // verify config is ok
    U.verify();

    expect(await U.fetch("upper")("ciao")).to.be.equal("CIAO");
  });

  test("promise returning", async () => {
    const U = uboss();
    const methods = {
      upper: data => new Promise(resolve => setTimeout(() => resolve(data.toUpperCase()), 10))
    };
    const config = {
      upper: {}
    };
    // load available methods
    U.load({ methods });
    // load configuration
    U.load({ config });
    // verify config is ok
    U.verify();

    expect(await U.fetch("upper")("ciao")).to.be.equal("CIAO");
  });

  test("with value returning beforeInvoke middleware", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({ middlewares: { increase: num => ++num } });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();
    expect(await U.fetch("increase")(1)).to.be.equal(3);
  });

  test("with value returning afterInvoke middleware", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({ middlewares: { increase: num => ++num } });

    U.load({
      config: {
        increase: {
          middlewares: {
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();
    expect(await U.fetch("increase")(1)).to.be.equal(3);
  });

  test("with promise returning middleware", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          return new Promise((resolve) => {
            setTimeout(()=> resolve(++num), 10)
          });
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();
    expect(await U.fetch("increase")(1)).to.be.equal(3);
  });

  test("with both afterInvoke and beforeInvoke middleware", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({ middlewares: { increase: num => ++num } });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();
    expect(await U.fetch("increase")(1)).to.be.equal(4);
  });

  test("with middleware that throws synchronously", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          throw new Error("sync Error");
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();

    await U.fetch("increase")("ciao")
      .then(() => fail('should not execute this'))
      .catch(e => {
        expect(e).to.be.an.error('sync Error');
      })
  });

  test("middleware that throws synchronously with statusCode", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          const err = new Error("sync Error");
          err.statusCode = 400;
          throw err
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();

    await U.fetch("increase")("ciao")
      .then(() => fail('should not execute this'))
      .catch(e => {
        expect(e).to.be.an.error('sync Error');
        expect(e.statusCode).to.be.equal(400);
      })

  });

  test("middleware that reject asynchronously", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          return new Promise((resolve, reject) => {
            setTimeout(()=> {
              const err = new Error("async Error");
              err.statusCode = 400;
              reject(err)
            }, 10)
          });
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();
    await U.fetch("increase")("ciao")
      .then(() => fail('should not execute this'))
      .catch(e => {
        expect(e).to.be.an.error('async Error');
        expect(e.statusCode).to.be.equal(400);
      })
  });

  test("middleware that throws asynchronously, (this should never happen right?)", async () => {
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: num => {
          return new Promise((resolve, reject) => {
            setTimeout(()=> {
              const err = new Error("async Error");
              err.statusCode = 400;
              throw err
            }, 10)
          });
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"],
            afterInvoke: ["increase"]
          }
        }
      }
    });

    U.verify();
    await U.fetch("increase")("ciao")
      .then(() => fail('should not execute this'))
      .catch(e => {
        expect(e).to.be.an.error('async Error');
        expect(e.statusCode).to.be.equal(400);
      })
  });

  test("with beforeInvoke middleware that interrupts the chain", async()=>{
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: (num, res) => {
          res(num + 10);
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            beforeInvoke: ["increase"]
          }
        }
      }
    });
    expect(await U.fetch("increase")(1)).to.be.equal(11);
  })

  test.only("with afterInvoke middleware that interrupts the chain", async()=>{
    const U = uboss();
    U.load({ methods: { increase: num => ++num } });

    U.load({
      middlewares: {
        increase: (num, res) => {
          res(num + 10);
        }
      }
    });

    U.load({
      config: {
        increase: {
          middlewares: {
            afterInvoke: ["increase"]
          }
        }
      }
    });
    expect(await U.fetch("increase")(1)).to.be.equal(12);
  })
});

