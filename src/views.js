(function (global) {
  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toNumber(value) {
    var n = Number(value);
    if (!isFinite(n)) {
      return 0;
    }
    return n;
  }

  function formatPrice(cents) {
    return "¥" + (toNumber(cents) / 100).toFixed(2);
  }

  function stockState(stock) {
    var quantity = toNumber(stock);
    if (quantity <= 0) {
      return "out";
    }
    if (quantity < 5) {
      return "low";
    }
    return "in";
  }

  function stockStatusLabel(stock) {
    var state = stockState(stock);
    if (state === "out") {
      return "无货";
    }
    if (state === "low") {
      return "库存紧张";
    }
    return "现货充足";
  }

  function normalizeCatalogItems(items) {
    var source = Array.isArray(items) ? items : [];
    var result = [];
    for (var i = 0; i < source.length; i += 1) {
      var raw = source[i] || {};
      result.push({
        id: String(raw.id || ""),
        name: String(raw.name || "未命名商品"),
        description: String(raw.description || ""),
        category: String(raw.category || "general"),
        priceCents: toNumber(raw.price_cents),
        stock: toNumber(raw.stock),
        shelfStatus: String(raw.shelf_status || "online"),
      });
    }
    return result;
  }

  function sortCatalogItems(items, mode) {
    var sorted = items.slice();
    sorted.sort(function (a, b) {
      var byName = String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
      var byID = String(a.id).localeCompare(String(b.id), "en");
      if (mode === "price_desc") {
        if (b.priceCents !== a.priceCents) {
          return b.priceCents - a.priceCents;
        }
        return byID;
      }
      if (mode === "price_asc") {
        if (a.priceCents !== b.priceCents) {
          return a.priceCents - b.priceCents;
        }
        return byID;
      }
      if (mode === "stock_desc") {
        if (b.stock !== a.stock) {
          return b.stock - a.stock;
        }
        return byID;
      }
      if (mode === "name_desc") {
        if (byName !== 0) {
          return -byName;
        }
        return byID;
      }
      if (byName !== 0) {
        return byName;
      }
      return byID;
    });
    return sorted;
  }

  function applyCatalogQuery(items, query) {
    var list = Array.isArray(items) ? items.slice() : [];
    var q = query || {};
    var keyword = String(q.keyword || "")
      .trim()
      .toLowerCase();
    var category = String(q.category || "all");
    var stockFilter = String(q.stock || "all");
    var sortMode = String(q.sort || "name_asc");

    if (category !== "all") {
      list = list.filter(function (item) {
        return item.category === category;
      });
    }
    if (stockFilter === "in") {
      list = list.filter(function (item) {
        return toNumber(item.stock) > 0;
      });
    }
    if (stockFilter === "out") {
      list = list.filter(function (item) {
        return toNumber(item.stock) <= 0;
      });
    }
    if (keyword) {
      list = list.filter(function (item) {
        var name = String(item.name || "").toLowerCase();
        var desc = String(item.description || "").toLowerCase();
        return name.indexOf(keyword) >= 0 || desc.indexOf(keyword) >= 0;
      });
    }
    return sortCatalogItems(list, sortMode);
  }

  function paginateCatalog(items, page, pageSize) {
    var size = toNumber(pageSize);
    if (size <= 0) {
      size = 8;
    }
    var totalItems = items.length;
    var totalPages = Math.max(1, Math.ceil(totalItems / size));
    var current = toNumber(page);
    if (current <= 0) {
      current = 1;
    }
    if (current > totalPages) {
      current = totalPages;
    }
    var start = (current - 1) * size;
    return {
      items: items.slice(start, start + size),
      page: current,
      totalPages: totalPages,
      totalItems: totalItems,
      pageSize: size,
    };
  }

  function buildCatalogCard(item) {
    var stockClass = "stock-" + stockState(item.stock);
    return (
      '<article class="product-card">' +
      '<p class="product-category">' +
      esc(item.category) +
      "</p>" +
      "<h3>" +
      esc(item.name) +
      "</h3>" +
      '<p class="text-muted">' +
      esc(item.description || "暂无描述") +
      "</p>" +
      '<p class="product-price">' +
      formatPrice(item.priceCents) +
      "</p>" +
      '<p class="stock-tag ' +
      stockClass +
      '">' +
      "库存 " +
      esc(item.stock) +
      " · " +
      stockStatusLabel(item.stock) +
      "</p>" +
      '<a class="btn-link" href="#/products/' +
      esc(item.id) +
      '">查看详情</a>' +
      "</article>"
    );
  }

  function renderHome(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>欢迎来到 Polaris Mall</h2>" +
      '<p class="text-muted">当前前端已完成路由、会话、权限守卫与商品浏览能力（W002）。</p>' +
      "<ul>" +
      "<li>商品页支持关键词筛选、分类筛选、排序和分页</li>" +
      "<li>商品详情页展示价格、库存和分类等信息</li>" +
      "<li>未登录访问 <code>/account</code> 会跳转到登录页</li>" +
      "<li>非 admin 用户访问 <code>/admin</code> 会跳转到账号页</li>" +
      "</ul>" +
      "</div>";
  }

  function renderCatalog(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>商品列表</h2>" +
      '<p id="catalog-meta" class="text-muted">加载中...</p>' +
      '<div id="catalog-controls" class="catalog-controls" hidden>' +
      '<input id="catalog-keyword" type="text" placeholder="搜索商品名称或描述" />' +
      '<select id="catalog-category"></select>' +
      '<select id="catalog-stock">' +
      '<option value="all">全部库存</option>' +
      '<option value="in">仅有货</option>' +
      '<option value="out">仅无货</option>' +
      "</select>" +
      '<select id="catalog-sort">' +
      '<option value="name_asc">名称 A-Z</option>' +
      '<option value="name_desc">名称 Z-A</option>' +
      '<option value="price_asc">价格从低到高</option>' +
      '<option value="price_desc">价格从高到低</option>' +
      '<option value="stock_desc">库存从高到低</option>' +
      "</select>" +
      "</div>" +
      '<div id="catalog-list" class="catalog-grid"></div>' +
      '<div id="catalog-pager" class="row" hidden>' +
      '<button id="catalog-prev" type="button">上一页</button>' +
      '<button id="catalog-next" type="button">下一页</button>' +
      "</div>" +
      "</div>";

    var meta = context.mount.querySelector("#catalog-meta");
    var list = context.mount.querySelector("#catalog-list");
    var controls = context.mount.querySelector("#catalog-controls");
    var pager = context.mount.querySelector("#catalog-pager");
    var prev = context.mount.querySelector("#catalog-prev");
    var next = context.mount.querySelector("#catalog-next");
    var keywordInput = context.mount.querySelector("#catalog-keyword");
    var categorySelect = context.mount.querySelector("#catalog-category");
    var stockSelect = context.mount.querySelector("#catalog-stock");
    var sortSelect = context.mount.querySelector("#catalog-sort");

    context.api
      .request("/api/v1/products")
      .then(function (payload) {
        var items = normalizeCatalogItems(payload.items || []);
        var query = {
          keyword: "",
          category: "all",
          stock: "all",
          sort: "name_asc",
        };
        var page = 1;
        var pageSize = 6;

        var categoryMap = { all: true };
        for (var i = 0; i < items.length; i += 1) {
          categoryMap[items[i].category] = true;
        }
        var categoryNames = Object.keys(categoryMap).sort();
        var categoryOptions = ['<option value="all">全部分类</option>'];
        for (var j = 0; j < categoryNames.length; j += 1) {
          var name = categoryNames[j];
          if (name === "all") {
            continue;
          }
          categoryOptions.push('<option value="' + esc(name) + '">' + esc(name) + "</option>");
        }
        categorySelect.innerHTML = categoryOptions.join("");

        function renderFilteredList() {
          var filtered = applyCatalogQuery(items, query);
          var pageData = paginateCatalog(filtered, page, pageSize);
          page = pageData.page;

          meta.textContent =
            "共 " +
            filtered.length +
            " 个结果，第 " +
            pageData.page +
            "/" +
            pageData.totalPages +
            " 页";

          if (!filtered.length) {
            list.innerHTML = '<p class="text-muted">未找到符合条件的商品</p>';
          } else {
            var html = [];
            for (var idx = 0; idx < pageData.items.length; idx += 1) {
              html.push(buildCatalogCard(pageData.items[idx]));
            }
            list.innerHTML = html.join("");
          }

          controls.hidden = false;
          pager.hidden = filtered.length <= pageSize;
          prev.disabled = pageData.page <= 1;
          next.disabled = pageData.page >= pageData.totalPages;
        }

        function onFilterChange() {
          query.keyword = keywordInput.value;
          query.category = categorySelect.value;
          query.stock = stockSelect.value;
          query.sort = sortSelect.value;
          page = 1;
          renderFilteredList();
        }

        keywordInput.addEventListener("input", onFilterChange);
        categorySelect.addEventListener("change", onFilterChange);
        stockSelect.addEventListener("change", onFilterChange);
        sortSelect.addEventListener("change", onFilterChange);
        prev.addEventListener("click", function () {
          page -= 1;
          renderFilteredList();
        });
        next.addEventListener("click", function () {
          page += 1;
          renderFilteredList();
        });

        renderFilteredList();
      })
      .catch(function (err) {
        meta.className = "text-danger";
        meta.textContent = err.message || "加载商品失败";
        list.innerHTML = "";
      });
  }

  function renderProductDetail(context) {
    var productId = context.params.id;
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>商品详情</h2>" +
      '<p id="detail-msg" class="text-muted">加载中...</p>' +
      '<div id="detail-body"></div>' +
      '<a class="btn-link" href="#/products">返回商品列表</a>' +
      "</div>";

    var msg = context.mount.querySelector("#detail-msg");
    var body = context.mount.querySelector("#detail-body");
    context.api
      .request("/api/v1/products/" + productId)
      .then(function (payload) {
        var item = normalizeCatalogItems([payload.item || {}])[0];
        var state = stockState(item.stock);
        var stockClass = state === "out" ? "text-danger" : "text-muted";
        msg.textContent = "加载成功";
        body.innerHTML =
          "<h3>" +
          esc(item.name) +
          "</h3>" +
          '<p class="text-muted">' +
          esc(item.description || "暂无描述") +
          "</p>" +
          "<ul>" +
          "<li>分类: " +
          esc(item.category) +
          "</li>" +
          "<li>价格: " +
          formatPrice(item.priceCents) +
          "</li>" +
          '<li class="' +
          stockClass +
          '">库存: ' +
          esc(item.stock) +
          "（" +
          stockStatusLabel(item.stock) +
          "）</li>" +
          "<li>上架状态: " +
          esc(item.shelfStatus) +
          "</li>" +
          "</ul>";
      })
      .catch(function (err) {
        msg.className = "text-danger";
        msg.textContent = err.message || "加载失败";
        body.innerHTML = "";
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
  global.Polaris.viewHelpers = {
    normalizeCatalogItems: normalizeCatalogItems,
    applyCatalogQuery: applyCatalogQuery,
    paginateCatalog: paginateCatalog,
    stockState: stockState,
    stockStatusLabel: stockStatusLabel,
  };
})(window);
