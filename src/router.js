(function (global) {
  function normalizePath(path) {
    if (!path) {
      return "/";
    }
    if (path.charAt(0) !== "/") {
      return "/" + path;
    }
    return path;
  }

  function currentPath() {
    var hash = global.location.hash || "#/";
    return normalizePath(hash.replace(/^#/, ""));
  }

  function matchRoute(path, routes) {
    if (routes[path]) {
      return { route: routes[path], params: {} };
    }
    var keys = Object.keys(routes);
    for (var idx = 0; idx < keys.length; idx += 1) {
      var key = keys[idx];
      if (key.indexOf("/:") === -1) {
        continue;
      }
      var pathParts = path.split("/");
      var keyParts = key.split("/");
      if (pathParts.length !== keyParts.length) {
        continue;
      }
      var params = {};
      var ok = true;
      for (var i = 0; i < keyParts.length; i += 1) {
        var keyPart = keyParts[i];
        var pathPart = pathParts[i];
        if (keyPart.charAt(0) === ":") {
          params[keyPart.slice(1)] = pathPart;
          continue;
        }
        if (keyPart !== pathPart) {
          ok = false;
          break;
        }
      }
      if (ok) {
        return { route: routes[key], params: params };
      }
    }
    return { route: routes["*"], params: {} };
  }

  function createRouter(config) {
    function navigate(path) {
      var target = normalizePath(path);
      if (currentPath() === target) {
        render();
        return;
      }
      global.location.hash = "#" + target;
    }

    function render() {
      var path = currentPath();
      var matched = matchRoute(path, config.routes);
      var route = matched.route;
      var state = config.getState();

      if (route.requiresAuth && !state.session.accessToken) {
        navigate("/login");
        return;
      }
      if (route.requiredRole) {
        var role = state.session.user && state.session.user.role;
        if (role !== route.requiredRole) {
          navigate("/account");
          return;
        }
      }

      route.render(config.makeViewContext(matched.params));
      config.onRoute(path);
    }

    function start() {
      if (!global.location.hash) {
        global.location.hash = "#/";
      }
      global.addEventListener("hashchange", render);
      render();
    }

    return {
      start: start,
      navigate: navigate,
      render: render,
    };
  }

  global.Polaris = global.Polaris || {};
  global.Polaris.router = {
    createRouter: createRouter,
  };
})(window);
