const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "index.html",
  "styles.css",
  "src/session.js",
  "src/router.js",
  "src/api-client.js",
  "src/app.js",
  "src/views.js",
];

function bytes(file) {
  return fs.statSync(path.join(ROOT, file)).size;
}

function kb(value) {
  return value / 1024;
}

function run() {
  const total = FILES.reduce((acc, file) => acc + bytes(file), 0);
  const views = bytes("src/views.js");

  assert.ok(kb(total) <= 120, `bundle size ${kb(total).toFixed(2)}KB exceeds 120KB`);
  assert.ok(kb(views) <= 80, `views.js size ${kb(views).toFixed(2)}KB exceeds 80KB`);

  console.log("bundle budget tests passed");
}

run();
