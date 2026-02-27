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

function testOrderFilterAndPagination() {
  const helpers = loadHelpers();
  const orders = helpers.normalizeOrderItems([
    { id: "O1", status: "pending_payment", total_cents: 1000, items: [] },
    { id: "O2", status: "paid", total_cents: 2000, items: [] },
    { id: "O3", status: "paid", total_cents: 3000, items: [] },
    { id: "O4", status: "done", total_cents: 4000, items: [] },
  ]);

  const paid = helpers.filterOrdersByStatus(orders, "paid");
  assert.strictEqual(paid.map((item) => item.id).join(","), "O2,O3");

  const pageData = helpers.paginateList(orders, 2, 2);
  assert.strictEqual(pageData.page, 2);
  assert.strictEqual(pageData.totalPages, 2);
  assert.strictEqual(pageData.items.map((item) => item.id).join(","), "O3,O4");
}

function testRefundableStatus() {
  const helpers = loadHelpers();
  assert.strictEqual(helpers.isRefundableOrderStatus("paid"), true);
  assert.strictEqual(helpers.isRefundableOrderStatus("shipped"), true);
  assert.strictEqual(helpers.isRefundableOrderStatus("done"), true);
  assert.strictEqual(helpers.isRefundableOrderStatus("pending_payment"), false);
  assert.strictEqual(helpers.isRefundableOrderStatus("canceled"), false);
}

function run() {
  testOrderFilterAndPagination();
  testRefundableStatus();
  console.log("order center logic tests passed");
}

run();
