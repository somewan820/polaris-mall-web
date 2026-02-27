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

function testFilterSortAndStock() {
  const helpers = loadHelpers();
  const items = helpers.normalizeCatalogItems([
    {
      id: "P1",
      name: "Alpha Phone",
      description: "flagship",
      category: "electronics",
      price_cents: 329900,
      stock: 8,
    },
    {
      id: "P2",
      name: "Beta Phone",
      description: "entry",
      category: "electronics",
      price_cents: 129900,
      stock: 2,
    },
    {
      id: "P3",
      name: "Cotton Towel",
      description: "bath",
      category: "home",
      price_cents: 9900,
      stock: 0,
    },
  ]);

  const filtered = helpers.applyCatalogQuery(items, {
    keyword: "phone",
    category: "electronics",
    stock: "all",
    sort: "price_desc",
  });
  assert.strictEqual(filtered.map((item) => item.id).join(","), "P1,P2");

  const outOnly = helpers.applyCatalogQuery(items, {
    keyword: "",
    category: "all",
    stock: "out",
    sort: "name_asc",
  });
  assert.strictEqual(outOnly.map((item) => item.id).join(","), "P3");
}

function testPagination() {
  const helpers = loadHelpers();
  const items = helpers.normalizeCatalogItems([
    { id: "P1", name: "A", price_cents: 100, stock: 1 },
    { id: "P2", name: "B", price_cents: 200, stock: 1 },
    { id: "P3", name: "C", price_cents: 300, stock: 1 },
    { id: "P4", name: "D", price_cents: 400, stock: 1 },
  ]);

  const pageData = helpers.paginateCatalog(items, 2, 2);
  assert.strictEqual(pageData.page, 2);
  assert.strictEqual(pageData.totalPages, 2);
  assert.strictEqual(pageData.items.map((item) => item.id).join(","), "P3,P4");
}

function run() {
  testFilterSortAndStock();
  testPagination();
  console.log("catalog logic tests passed");
}

run();
