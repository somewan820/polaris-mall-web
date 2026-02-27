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
    Date,
  });
  vm.runInContext(code, context, { filename: "views.js" });
  return mockWindow.Polaris.viewHelpers;
}

function testOutcomeRules() {
  const helpers = loadHelpers();

  assert.strictEqual(helpers.derivePaymentOutcome("pending_payment", "pending"), "pending");
  assert.strictEqual(helpers.derivePaymentOutcome("paid", "succeeded"), "success");
  assert.strictEqual(helpers.derivePaymentOutcome("done", "succeeded"), "success");
  assert.strictEqual(helpers.derivePaymentOutcome("pending_payment", "failed"), "failed");
  assert.strictEqual(helpers.derivePaymentOutcome("canceled", "pending"), "failed");
}

function testMockpayPayloadShape() {
  const helpers = loadHelpers();
  const payload = helpers.createMockpayCallbackPayload("O0001", "Success");

  assert.strictEqual(payload.order_id, "O0001");
  assert.strictEqual(payload.result, "success");
  assert.ok(payload.external_txn_id.indexOf("txn-web-") === 0);
}

function run() {
  testOutcomeRules();
  testMockpayPayloadShape();
  console.log("payment logic tests passed");
}

run();
