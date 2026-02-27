(function (global) {
  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHome(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>欢迎来到 Polaris Mall</h2>" +
      '<p class="text-muted">这是 W001 阶段的前端壳子，已具备路由、登录态、接口封装和权限守卫。</p>' +
      "<ul>" +
      "<li>商品页已经接入 <code>/api/v1/products</code></li>" +
      "<li>未登录访问 <code>/account</code> 会跳转到登录页</li>" +
      "<li>非 admin 用户访问 <code>/admin</code> 会跳转到账号页</li>" +
      "<li>登录成功后会将会话持久化到 localStorage</li>" +
      "</ul>" +
      "</div>";
  }

  function renderCatalog(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>商品列表</h2>" +
      '<p class="text-muted">加载中...</p>' +
      '<div id="catalog-list"></div>' +
      "</div>";

    var list = context.mount.querySelector("#catalog-list");
    var loading = context.mount.querySelector(".text-muted");
    context.api
      .request("/api/v1/products")
      .then(function (payload) {
        var items = payload.items || [];
        loading.textContent = "共 " + items.length + " 个在线商品";
        if (!items.length) {
          list.innerHTML = '<p class="text-muted">暂无可展示商品</p>';
          return;
        }
        var html = [];
        for (var i = 0; i < items.length; i += 1) {
          var item = items[i];
          html.push(
            '<div class="card">' +
              "<h3>" +
              esc(item.name) +
              "</h3>" +
              "<p>" +
              esc(item.description) +
              "</p>" +
              '<p class="text-muted">价格: ¥' +
              (Number(item.price_cents || 0) / 100).toFixed(2) +
              " | 库存: " +
              esc(item.stock) +
              "</p>" +
              '<a href="#/products/' +
              esc(item.id) +
              '">查看详情</a>' +
              "</div>"
          );
        }
        list.innerHTML = html.join("");
      })
      .catch(function (err) {
        loading.className = "text-danger";
        loading.textContent = err.message || "加载商品失败";
      });
  }

  function renderProductDetail(context) {
    var productId = context.params.id;
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>商品详情</h2>" +
      '<p id="detail-msg" class="text-muted">加载中...</p>' +
      '<pre id="detail-json"></pre>' +
      '<a href="#/products">返回商品列表</a>' +
      "</div>";
    var msg = context.mount.querySelector("#detail-msg");
    var output = context.mount.querySelector("#detail-json");
    context.api
      .request("/api/v1/products/" + productId)
      .then(function (payload) {
        msg.textContent = "加载成功";
        output.textContent = JSON.stringify(payload.item || {}, null, 2);
      })
      .catch(function (err) {
        msg.className = "text-danger";
        msg.textContent = err.message || "加载失败";
      });
  }

  function renderLogin(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>登录</h2>" +
      '<form id="login-form">' +
      '<label class="label">邮箱</label>' +
      '<input name="email" type="email" required placeholder="buyer@example.com" />' +
      '<label class="label">密码</label>' +
      '<input name="password" type="password" required placeholder="请输入密码" />' +
      '<button class="btn-primary" type="submit">登录</button>' +
      '<p id="login-msg" class="text-danger"></p>' +
      "</form>" +
      "</div>" +
      '<div class="card">' +
      "<h3>快速注册</h3>" +
      '<form id="register-form">' +
      '<label class="label">邮箱</label>' +
      '<input name="email" type="email" required placeholder="new@example.com" />' +
      '<label class="label">密码</label>' +
      '<input name="password" type="password" required placeholder="请输入密码" />' +
      '<label class="label">角色</label>' +
      '<input name="role" type="text" value="buyer" placeholder="buyer/admin/ops" />' +
      '<button class="btn-primary" type="submit">注册</button>' +
      '<p id="register-msg" class="text-danger"></p>' +
      "</form>" +
      "</div>";

    var loginForm = context.mount.querySelector("#login-form");
    var loginMsg = context.mount.querySelector("#login-msg");
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      loginMsg.textContent = "";
      var data = new FormData(loginForm);
      context.api
        .login({
          email: data.get("email"),
          password: data.get("password"),
        })
        .then(function () {
          context.renderNav();
          context.navigate("/account");
        })
        .catch(function (err) {
          loginMsg.textContent = err.message || "登录失败";
        });
    });

    var registerForm = context.mount.querySelector("#register-form");
    var registerMsg = context.mount.querySelector("#register-msg");
    registerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      registerMsg.textContent = "";
      var data = new FormData(registerForm);
      context.api
        .register({
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role"),
        })
        .then(function () {
          registerMsg.className = "text-muted";
          registerMsg.textContent = "注册成功，请使用上方登录。";
        })
        .catch(function (err) {
          registerMsg.className = "text-danger";
          registerMsg.textContent = err.message || "注册失败";
        });
    });
  }

  function renderAccount(context) {
    var session = context.getSession();
    var user = session.user || {};
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>账号中心</h2>" +
      '<p class="text-muted">当前登录用户</p>' +
      "<ul>" +
      "<li>ID: " +
      esc(user.id) +
      "</li>" +
      "<li>Email: " +
      esc(user.email) +
      "</li>" +
      "<li>Role: " +
      esc(user.role) +
      "</li>" +
      "</ul>" +
      '<div class="row">' +
      '<button id="refresh-me" class="btn-primary" type="button">刷新用户信息</button>' +
      '<button id="logout-btn" type="button">退出登录</button>' +
      "</div>" +
      '<p id="account-msg" class="text-muted"></p>' +
      "</div>";

    var msg = context.mount.querySelector("#account-msg");
    context.mount.querySelector("#refresh-me").addEventListener("click", function () {
      msg.className = "text-muted";
      msg.textContent = "刷新中...";
      context.api
        .me()
        .then(function (payload) {
          msg.textContent = "刷新成功: " + (payload.user && payload.user.email);
          context.renderNav();
          context.router.render();
        })
        .catch(function (err) {
          msg.className = "text-danger";
          msg.textContent = err.message || "刷新失败";
        });
    });

    context.mount.querySelector("#logout-btn").addEventListener("click", function () {
      context.setSession({ accessToken: "", refreshToken: "", user: null });
      context.renderNav();
      context.navigate("/login");
    });
  }

  function renderAdmin(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>管理员探针</h2>" +
      '<p class="text-muted">此页面需要 admin 角色。</p>' +
      '<button id="admin-probe" class="btn-primary" type="button">调用 /api/v1/admin/ping</button>' +
      '<p id="admin-msg" class="text-muted"></p>' +
      '<pre id="admin-output"></pre>' +
      "</div>";

    var msg = context.mount.querySelector("#admin-msg");
    var output = context.mount.querySelector("#admin-output");
    context.mount.querySelector("#admin-probe").addEventListener("click", function () {
      msg.className = "text-muted";
      msg.textContent = "请求中...";
      output.textContent = "";
      context.api
        .adminPing()
        .then(function (payload) {
          msg.textContent = "请求成功";
          output.textContent = JSON.stringify(payload, null, 2);
        })
        .catch(function (err) {
          msg.className = "text-danger";
          msg.textContent = err.message || "请求失败";
          output.textContent = JSON.stringify(err, null, 2);
        });
    });
  }

  function renderNotFound(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>页面不存在</h2>" +
      '<p class="text-muted">请从导航返回到可用页面。</p>' +
      "</div>";
  }

  global.Polaris = global.Polaris || {};
  global.Polaris.views = {
    home: renderHome,
    catalog: renderCatalog,
    productDetail: renderProductDetail,
    login: renderLogin,
    account: renderAccount,
    admin: renderAdmin,
    notFound: renderNotFound,
  };
})(window);
