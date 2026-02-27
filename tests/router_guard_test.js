const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function createMockWindow(initialHash) {
  const listeners = { hashchange: [] };
  const location = { _hash: initialHash || "#/" };
  Object.defineProperty(location, "hash", {
    get() {
      return this._hash;
    },
    set(nextValue) {
      this._hash = nextValue;
      const handlers = listeners.hashchange || [];
      for (let i = 0; i < handlers.length; i += 1) {
        handlers[i]();
      }
    },
  });
  return {
    location,
    Polaris: {},
    addEventListener(event, handler) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    },
  };
}

function loadRouter(windowObj) {
  const routerPath = path.resolve(__dirname, "../src/router.js");
  const code = fs.readFileSync(routerPath, "utf8");
  const context = vm.createContext({
    window: windowObj,
    Object,
    String,
    console,
  });
  vm.runInContext(code, context, { filename: "router.js" });
  return windowObj.Polaris.router.createRouter;
}

function testRedirectToLoginWhenUnauthenticated() {
  const mockWindow = createMockWindow("#/account");
  const createRouter = loadRouter(mockWindow);
  const hits = [];
  const router = createRouter({
    routes: {
      "/login": { requiresAuth: false, render() { hits.push("login"); } },
      "/account": { requiresAuth: true, render() { hits.push("account"); } },
      "*": { requiresAuth: false, render() { hits.push("fallback"); } },
    },
    getState() {
      return { session: { accessToken: "", user: null } };
    },
    makeViewContext() {
      return {};
    },
    onRoute() {},
  });
  router.start();
  assert.strictEqual(mockWindow.location.hash, "#/login");
  assert.strictEqual(hits[hits.length - 1], "login");
}

function testRedirectToAccountWhenRoleMismatch() {
  const mockWindow = createMockWindow("#/admin");
  const createRouter = loadRouter(mockWindow);
  const hits = [];
  const router = createRouter({
    routes: {
      "/account": { requiresAuth: true, render() { hits.push("account"); } },
      "/admin": {
        requiresAuth: true,
        requiredRole: "admin",
        render() {
          hits.push("admin");
        },
      },
      "*": { requiresAuth: false, render() { hits.push("fallback"); } },
    },
    getState() {
      return {
        session: { accessToken: "token", user: { role: "buyer" } },
      };
    },
    makeViewContext() {
      return {};
    },
    onRoute() {},
  });
  router.start();
  assert.strictEqual(mockWindow.location.hash, "#/account");
  assert.strictEqual(hits[hits.length - 1], "account");
}

function run() {
  testRedirectToLoginWhenUnauthenticated();
  testRedirectToAccountWhenRoleMismatch();
  console.log("router guard tests passed");
}

run();

