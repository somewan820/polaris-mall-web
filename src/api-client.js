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

    return {
      request: request,
      register: register,
      login: login,
      refreshSession: refreshSession,
      me: me,
      adminPing: adminPing,
    };
  }

  global.Polaris = global.Polaris || {};
  global.Polaris.api = {
    createApiClient: createApiClient,
  };
})(window);

