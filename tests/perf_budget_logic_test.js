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

function testRenderBudgetRule() {
  const helpers = loadHelpers();
  assert.strictEqual(helpers.isRenderWithinBudget(24, 40), true);
  assert.strictEqual(helpers.isRenderWithinBudget(41, 40), false);
  assert.strictEqual(helpers.isRenderWithinBudget(0, 0), true);
}

function run() {
  testRenderBudgetRule();
  console.log("performance budget logic tests passed");
}

run();
