const uboss = require("./index");
const sinon = require('sinon');
const U = uboss();
const EE = require('events').EventEmitter;
const E = new EE();

const util = require('util');
const setImmediateAsync = util.promisify(setImmediate);

const spy = sinon.spy();
E.on('called', spy);

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
    slowFn: () => {
      console.log('completed execution')
    }
  }
});

U.load({ config });

// compose API
const API = U.compose();

async function boot(){
  console.log(await API.increase(1));
  console.log('done')
  await new Promise((r) => setTimeout(()=>r(), 1000))
}

boot();