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

function testBuildCheckoutPreviewInput() {
  const helpers = loadHelpers();
  const payload = helpers.buildCheckoutPreviewInput({
    shipping_cents: "500",
    discount_cents: "-20",
    coupon_code: "  SPRING  ",
  });

  assert.strictEqual(payload.shipping_cents, 500);
  assert.strictEqual(payload.discount_cents, 0);
  assert.strictEqual(payload.coupon_code, "SPRING");
}

function testFallbackWhenInputMissing() {
  const helpers = loadHelpers();
  const payload = helpers.buildCheckoutPreviewInput();

  assert.strictEqual(payload.shipping_cents, 0);
  assert.strictEqual(payload.discount_cents, 0);
  assert.strictEqual(payload.coupon_code, "");
}

function run() {
  testBuildCheckoutPreviewInput();
  testFallbackWhenInputMissing();
  console.log("checkout payload tests passed");
}

run();
