(function (global) {
  var Polaris = global.Polaris;
  var mount = global.document.getElementById("app");
  var nav = global.document.getElementById("nav-links");
  var apiBaseUrl = global.POLARIS_API_BASE_URL || "http://127.0.0.1:9000";

  var sessionState = Polaris.session.load();

  function getSession() {
    return sessionState;
  }

  function setSession(nextSession) {
    sessionState = {
      accessToken: nextSession.accessToken || "",
      refreshToken: nextSession.refreshToken || "",
      user: nextSession.user || null,
    };
    Polaris.session.save(sessionState);
  }

  var api = Polaris.api.createApiClient(apiBaseUrl, getSession, setSession);

  var router = null;

  function navLink(path, label, activePath) {
    var activeClass = activePath === path ? ' class="active"' : "";
    return '<a href="#' + path + '"' + activeClass + ">" + label + "</a>";
  }

  function renderNav(activePath) {
    var session = getSession();
    var html = [];
    html.push(navLink("/", "首页", activePath));
    html.push(navLink("/products", "商品", activePath));
    if (!session.accessToken) {
      html.push(navLink("/login", "登录", activePath));
    } else {
      html.push(navLink("/cart", "购物车", activePath));
      html.push(navLink("/account", "账号", activePath));
      if (session.user && session.user.role === "admin") {
        html.push(navLink("/admin", "管理探针", activePath));
      }
      html.push('<button id="logout-button" type="button">退出</button>');
    }
    nav.innerHTML = html.join("");

    var logoutButton = global.document.getElementById("logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        setSession({ accessToken: "", refreshToken: "", user: null });
        renderNav("/");
        router.navigate("/login");
      });
    }
  }

  function makeViewContext(params) {
    return {
      mount: mount,
      api: api,
      router: router,
      params: params || {},
      getSession: getSession,
      setSession: setSession,
      navigate: function (path) {
        router.navigate(path);
      },
      renderNav: function () {
        var activePath = (global.location.hash || "#/").replace(/^#/, "");
        renderNav(activePath || "/");
      },
    };
  }

  var routes = {
    "/": {
      requiresAuth: false,
      render: Polaris.views.home,
    },
    "/login": {
      requiresAuth: false,
      render: Polaris.views.login,
    },
    "/products": {
      requiresAuth: false,
      render: Polaris.views.catalog,
    },
    "/products/:id": {
      requiresAuth: false,
      render: Polaris.views.productDetail,
    },
    "/cart": {
      requiresAuth: true,
      render: Polaris.views.cart,
    },
    "/checkout": {
      requiresAuth: true,
      render: Polaris.views.checkout,
    },
    "/payments/:orderId": {
      requiresAuth: true,
      render: Polaris.views.payment,
    },
    "/payment-result/:orderId": {
      requiresAuth: true,
      render: Polaris.views.paymentResult,
    },
    "/account": {
      requiresAuth: true,
      render: Polaris.views.account,
    },
    "/admin": {
      requiresAuth: true,
      requiredRole: "admin",
      render: Polaris.views.admin,
    },
    "*": {
      requiresAuth: false,
      render: Polaris.views.notFound,
    },
  };

  router = Polaris.router.createRouter({
    routes: routes,
    getState: function () {
      return { session: getSession() };
    },
    makeViewContext: makeViewContext,
    onRoute: function (path) {
      renderNav(path);
    },
  });

  renderNav("/");
  router.start();
})(window);
