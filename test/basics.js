/**
 * Created by davide_talesco on 13/6/18.
 * This file contains the unit tests of paip
 */

"use strict";
const _ = require("lodash");
const uboss = require("../index2");
const Lab = require("lab");
const { expect, fail } = require("code");

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

  test("2 methods with same name", async () => {
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
});

experiment("compose", () => {
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

  test("config referencing a not loaded middleware should throw", () => {
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

  test("with value returning afterInvoke middleware", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            afterInvoke: ["increase"]
          }
        }
      }
    }
    U.load({ methods: { increase: num => ++num } });

    U.load({ middlewares: { increase: num => ++num } });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(3);
  });

  test("with promise returning middleware", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            afterInvoke: ["increase"]
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

  test("with both afterInvoke and beforeInvoke middleware", async () => {
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

    U.load({ middlewares: { increase: num => ++num } });

    U.load({ config });

    // compose API
    const API = U.compose();

    expect(await API.increase(1)).to.be.equal(4);
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

  test("with afterInvoke middleware that interrupts the chain", async () => {
    const U = uboss();
    const config = {
      methods: {
        increase: {
          middlewares: {
            afterInvoke: ["increase"]
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

    expect(await API.increase(1)).to.be.equal(12);
  });
});
