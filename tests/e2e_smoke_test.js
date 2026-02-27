const http = require("http");
const assert = require("assert");

function sendJSON(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function createMockServer(seed) {
  const users = new Map();
  const tokens = new Map();
  const carts = new Map();
  const orders = new Map();
  let nextOrder = 1;

  const products = [
    {
      id: `P-${seed}-001`,
      name: `Smoke Product ${seed}`,
      description: "for e2e smoke",
      category: "smoke",
      price_cents: 1999,
      stock: 99,
      shelf_status: "online",
    },
  ];

  function requireUser(req, res) {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ")) {
      sendJSON(res, 401, { error: { code: "AUTH_INVALID", message: "missing token" } });
      return null;
    }
    const token = auth.slice("Bearer ".length).trim();
    const email = tokens.get(token);
    if (!email || !users.has(email)) {
      sendJSON(res, 401, { error: { code: "AUTH_INVALID", message: "invalid token" } });
      return null;
    }
    return users.get(email);
  }

  return http.createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/api/v1/auth/register") {
        const body = await readJSON(req);
        const email = String(body.email || "").trim();
        if (!email || users.has(email)) {
          sendJSON(res, 400, { error: { code: "REGISTER_INVALID", message: "email invalid" } });
          return;
        }
        users.set(email, {
          id: `U-${users.size + 1}`,
          email,
          password: String(body.password || ""),
          role: String(body.role || "buyer"),
        });
        sendJSON(res, 201, { ok: true });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v1/auth/login") {
        const body = await readJSON(req);
        const email = String(body.email || "").trim();
        const user = users.get(email);
        if (!user || user.password !== String(body.password || "")) {
          sendJSON(res, 401, { error: { code: "AUTH_INVALID", message: "invalid credential" } });
          return;
        }
        const token = `token-${seed}-${email}`;
        tokens.set(token, email);
        sendJSON(res, 200, {
          access_token: token,
          refresh_token: `refresh-${token}`,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        });
        return;
      }

      if (req.method === "GET" && req.url === "/api/v1/products") {
        sendJSON(res, 200, { items: products });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v1/cart/items") {
        const user = requireUser(req, res);
        if (!user) {
          return;
        }
        const body = await readJSON(req);
        const productID = String(body.product_id || "");
        const quantity = Number(body.quantity || 0);
        const product = products.find((item) => item.id === productID);
        if (!product || quantity <= 0) {
          sendJSON(res, 400, { error: { code: "CART_INVALID", message: "invalid cart input" } });
          return;
        }
        carts.set(user.id, {
          product,
          quantity,
        });
        sendJSON(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v1/orders") {
        const user = requireUser(req, res);
        if (!user) {
          return;
        }
        const cart = carts.get(user.id);
        if (!cart) {
          sendJSON(res, 400, { error: { code: "ORDER_INVALID", message: "cart empty" } });
          return;
        }
        const orderID = `O-${seed}-${String(nextOrder).padStart(4, "0")}`;
        nextOrder += 1;
        const order = {
          id: orderID,
          user_id: user.id,
          status: "pending_payment",
          total_cents: cart.product.price_cents * cart.quantity,
          items: [
            {
              product_id: cart.product.id,
              name: cart.product.name,
              price_cents: cart.product.price_cents,
              quantity: cart.quantity,
              line_total_cents: cart.product.price_cents * cart.quantity,
            },
          ],
        };
        orders.set(orderID, order);
        carts.delete(user.id);
        sendJSON(res, 201, { order });
        return;
      }

      if (req.method === "GET" && req.url === "/api/v1/orders") {
        const user = requireUser(req, res);
        if (!user) {
          return;
        }
        const items = [];
        for (const order of orders.values()) {
          if (order.user_id === user.id) {
            items.push(order);
          }
        }
        sendJSON(res, 200, { items });
        return;
      }

      if (req.method === "GET" && req.url.startsWith("/api/v1/orders/")) {
        const user = requireUser(req, res);
        if (!user) {
          return;
        }
        const orderID = req.url.replace("/api/v1/orders/", "");
        const order = orders.get(orderID);
        if (!order || order.user_id !== user.id) {
          sendJSON(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "not found" } });
          return;
        }
        sendJSON(res, 200, { order });
        return;
      }

      sendJSON(res, 404, { error: { code: "NOT_FOUND", message: "not found" } });
    } catch (_err) {
      sendJSON(res, 500, { error: { code: "SERVER_ERROR", message: "server error" } });
    }
  });
}

async function requestJSON(baseURL, method, path, body, token) {
  const headers = {};
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(baseURL + path, {
    method,
    headers,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = payload && payload.error && payload.error.message ? payload.error.message : "request failed";
    throw new Error(`${method} ${path} failed: ${message}`);
  }
  return payload;
}

async function run() {
  const seed = process.env.SMOKE_SEED || "seed-001";
  const server = createMockServer(seed);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;

  try {
    const buyerEmail = `buyer-${seed}@example.com`;
    await requestJSON(baseURL, "POST", "/api/v1/auth/register", {
      email: buyerEmail,
      password: "buyer-pass",
      role: "buyer",
    });

    const login = await requestJSON(baseURL, "POST", "/api/v1/auth/login", {
      email: buyerEmail,
      password: "buyer-pass",
    });
    const token = login.access_token;

    const products = await requestJSON(baseURL, "GET", "/api/v1/products");
    assert.ok(Array.isArray(products.items) && products.items.length > 0, "products should not be empty");
    const product = products.items[0];

    await requestJSON(
      baseURL,
      "POST",
      "/api/v1/cart/items",
      {
        product_id: product.id,
        quantity: 2,
      },
      token
    );

    const created = await requestJSON(baseURL, "POST", "/api/v1/orders", {}, token);
    assert.ok(created.order && created.order.id, "order id should exist");

    const list = await requestJSON(baseURL, "GET", "/api/v1/orders", null, token);
    assert.ok(Array.isArray(list.items) && list.items.length === 1, "order list should include one order");
    assert.strictEqual(list.items[0].id, created.order.id);

    const detail = await requestJSON(baseURL, "GET", `/api/v1/orders/${created.order.id}`, null, token);
    assert.strictEqual(detail.order.id, created.order.id);
    assert.strictEqual(detail.order.status, "pending_payment");
    assert.ok(Array.isArray(detail.order.items) && detail.order.items.length === 1, "order items should exist");

    console.log("e2e smoke test passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
