(function (global) {
  function makeError(status, payload) {
    var error = payload && payload.error ? payload.error : {};
    return {
      status: status,
      code: error.code || "REQUEST_FAILED",
      message: error.message || "请求失败",
    };
  }

  function createApiClient(baseUrl, getSession, setSession) {
    function request(path, options) {
      var opts = options || {};
      var headers = Object.assign({}, opts.headers || {});
      var session = getSession();
      if (session.accessToken) {
        headers.Authorization = "Bearer " + session.accessToken;
      }
      if (opts.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }

      return fetch(baseUrl + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      }).then(function (response) {
        return response
          .text()
          .then(function (text) {
            var payload = {};
            if (text) {
              try {
                payload = JSON.parse(text);
              } catch (_err) {
                payload = {};
              }
            }
            if (!response.ok) {
              throw makeError(response.status, payload);
            }
            return payload;
          });
      });
    }

    function register(input) {
      return request("/api/v1/auth/register", {
        method: "POST",
        body: input,
      });
    }

    function login(input) {
      return request("/api/v1/auth/login", {
        method: "POST",
        body: input,
      }).then(function (payload) {
        setSession({
          accessToken: payload.access_token || "",
          refreshToken: payload.refresh_token || "",
          user: payload.user || null,
        });
        return payload;
      });
    }

    function refreshSession() {
      var session = getSession();
      if (!session.refreshToken) {
        return Promise.reject({
          status: 401,
          code: "REFRESH_REQUIRED",
          message: "没有可用的刷新令牌",
        });
      }
      return request("/api/v1/auth/refresh", {
        method: "POST",
        body: { refresh_token: session.refreshToken },
      }).then(function (payload) {
        setSession({
          accessToken: payload.access_token || "",
          refreshToken: payload.refresh_token || "",
          user: session.user || null,
        });
        return payload;
      });
    }

    function me() {
      return request("/api/v1/auth/me", { method: "GET" }).then(function (payload) {
        var session = getSession();
        setSession({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: payload.user || null,
        });
        return payload;
      });
    }

    function adminPing() {
      return request("/api/v1/admin/ping", { method: "GET" });
    }

    function getCart() {
      return request("/api/v1/cart", { method: "GET" });
    }

    function addCartItem(input) {
      return request("/api/v1/cart/items", {
        method: "POST",
        body: input,
      });
    }

    function updateCartItem(productID, quantity) {
      return request("/api/v1/cart/items/" + encodeURIComponent(productID), {
        method: "PATCH",
        body: { quantity: quantity },
      });
    }

    function removeCartItem(productID) {
      return request("/api/v1/cart/items/" + encodeURIComponent(productID), {
        method: "DELETE",
      });
    }

    function checkoutPreview(input) {
      return request("/api/v1/checkout/preview", {
        method: "POST",
        body: input,
      });
    }

    function createOrder(input) {
      return request("/api/v1/orders", {
        method: "POST",
        body: input || {},
      });
    }

    function listOrders() {
      return request("/api/v1/orders", { method: "GET" });
    }

    function getOrder(orderID) {
      return request("/api/v1/orders/" + encodeURIComponent(orderID), { method: "GET" });
    }

    function createPayment(orderID, provider) {
      return request("/api/v1/payments/create", {
        method: "POST",
        body: {
          order_id: orderID,
          provider: provider || "mockpay",
        },
      });
    }

    function getPaymentByOrder(orderID) {
      return request("/api/v1/payments/order/" + encodeURIComponent(orderID), { method: "GET" });
    }

    function mockpayCallback(input, signature) {
      return request("/api/v1/payments/callback/mockpay", {
        method: "POST",
        headers: {
          "X-Mockpay-Signature": signature || "",
          "Content-Type": "application/json",
        },
        body: input,
      });
    }

    function getOrderTracking(orderID) {
      return request("/api/v1/orders/" + encodeURIComponent(orderID) + "/tracking", {
        method: "GET",
      });
    }

    function requestRefund(orderID, input) {
      return request("/api/v1/orders/" + encodeURIComponent(orderID) + "/refunds", {
        method: "POST",
        body: input || {},
      });
    }

    function getRefund(orderID) {
      return request("/api/v1/orders/" + encodeURIComponent(orderID) + "/refunds", {
        method: "GET",
      });
    }

    return {
      request: request,
      register: register,
      login: login,
      refreshSession: refreshSession,
      me: me,
      adminPing: adminPing,
      getCart: getCart,
      addCartItem: addCartItem,
      updateCartItem: updateCartItem,
      removeCartItem: removeCartItem,
      checkoutPreview: checkoutPreview,
      createOrder: createOrder,
      listOrders: listOrders,
      getOrder: getOrder,
      createPayment: createPayment,
      getPaymentByOrder: getPaymentByOrder,
      mockpayCallback: mockpayCallback,
      getOrderTracking: getOrderTracking,
      requestRefund: requestRefund,
      getRefund: getRefund,
    };
  }

  global.Polaris = global.Polaris || {};
  global.Polaris.api = {
    createApiClient: createApiClient,
  };
})(window);
