const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function loadHelpers() {
  const viewsPath = path.resolve(__dirname, "../src/views.js");
  const code = fs.readFileSync(viewsPath, "utf8");
  const mockWindow = { Polaris: {} };
  const context = vm.createContext({
    window: mockWindow,
    String,
    Number,
    Math,
    Array,
    Object,
    isFinite,
  });
  vm.runInContext(code, context, { filename: "views.js" });
  return mockWindow.Polaris.viewHelpers;
}

function testTransientRules() {
  const helpers = loadHelpers();

  assert.strictEqual(helpers.isTransientError({ status: 503 }), true);
  assert.strictEqual(helpers.isTransientError({ status: 429 }), true);
  assert.strictEqual(helpers.isTransientError({ status: 408 }), true);
  assert.strictEqual(helpers.isTransientError({ status: 400 }), false);
  assert.strictEqual(helpers.isTransientError({ status: 404 }), false);
  assert.strictEqual(helpers.isTransientError({ status: 0 }), true);
  assert.strictEqual(helpers.isTransientError({}), true);
}

function run() {
  testTransientRules();
  console.log("resilience logic tests passed");
}

run();
