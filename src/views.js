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

  function toNonNegativeInt(value) {
    var n = Math.floor(toNumber(value));
    if (n < 0) {
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

  function buildCheckoutPreviewInput(input) {
    var source = input || {};
    return {
      shipping_cents: toNonNegativeInt(source.shipping_cents),
      discount_cents: toNonNegativeInt(source.discount_cents),
      coupon_code: String(source.coupon_code || "").trim(),
    };
  }

  function createMockpayCallbackPayload(orderID, result) {
    return {
      order_id: String(orderID || "").trim(),
      external_txn_id: "txn-web-" + String(Date.now()),
      result: String(result || "").trim().toLowerCase(),
    };
  }

  function derivePaymentOutcome(orderStatus, paymentStatus) {
    var order = String(orderStatus || "").toLowerCase();
    var payment = String(paymentStatus || "").toLowerCase();
    if (payment === "succeeded" || order === "paid" || order === "shipped" || order === "done") {
      return "success";
    }
    if (payment === "failed" || order === "canceled") {
      return "failed";
    }
    return "pending";
  }

  function normalizeOrderItems(items) {
    var source = Array.isArray(items) ? items : [];
    var result = [];
    for (var i = 0; i < source.length; i += 1) {
      var raw = source[i] || {};
      var lines = Array.isArray(raw.items) ? raw.items : [];
      result.push({
        id: String(raw.id || ""),
        status: String(raw.status || ""),
        totalCents: toNumber(raw.total_cents),
        items: lines,
        createdAt: String(raw.created_at || ""),
        updatedAt: String(raw.updated_at || ""),
      });
    }
    return result;
  }

  function filterOrdersByStatus(items, status) {
    var list = Array.isArray(items) ? items.slice() : [];
    var mode = String(status || "all");
    if (mode === "all") {
      return list;
    }
    return list.filter(function (item) {
      return String(item.status || "") === mode;
    });
  }

  function paginateList(items, page, pageSize) {
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

  function isRefundableOrderStatus(status) {
    var normalized = String(status || "").toLowerCase();
    return normalized === "paid" || normalized === "shipped" || normalized === "done";
  }

  function isTransientError(err) {
    if (!err) {
      return true;
    }
    var status = toNumber(err.status);
    if (!status) {
      return true;
    }
    return status === 408 || status === 429 || status >= 500;
  }

  function nowMs() {
    if (global.performance && typeof global.performance.now === "function") {
      return global.performance.now();
    }
    return Date.now();
  }

  function isRenderWithinBudget(durationMs, budgetMs) {
    return toNumber(durationMs) <= toNumber(budgetMs);
  }

  function trackRenderBudget(label, startTimeMs, budgetMs) {
    var duration = nowMs() - toNumber(startTimeMs);
    if (!isRenderWithinBudget(duration, budgetMs) && global.console && typeof global.console.warn === "function") {
      global.console.warn("[perf-budget] " + label + " render took " + duration.toFixed(1) + "ms, budget=" + budgetMs + "ms");
    }
    return duration;
  }

  function encodeHex(bytes) {
    var output = [];
    for (var i = 0; i < bytes.length; i += 1) {
      var value = bytes[i].toString(16);
      if (value.length === 1) {
        value = "0" + value;
      }
      output.push(value);
    }
    return output.join("");
  }

  function signMockpayPayload(secret, payloadJSON) {
    if (!global.crypto || !global.crypto.subtle || typeof global.TextEncoder !== "function") {
      return Promise.reject(new Error("当前环境不支持 mockpay 回调签名"));
    }
    var encoder = new global.TextEncoder();
    var keyData = encoder.encode(String(secret || ""));
    var payloadData = encoder.encode(String(payloadJSON || ""));

    return global.crypto.subtle
      .importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (key) {
        return global.crypto.subtle.sign("HMAC", key, payloadData);
      })
      .then(function (buffer) {
        return encodeHex(new Uint8Array(buffer));
      });
  }

  function buildCatalogCard(item, canAdd) {
    var stockClass = "stock-" + stockState(item.stock);
    var addButton = "";
    if (canAdd && item.stock > 0) {
      addButton =
        '<button type="button" class="btn-primary" data-add-product-id="' +
        esc(item.id) +
        '">加入购物车</button>';
    } else if (!canAdd) {
      addButton = '<a class="btn-link" href="#/login">登录后加入购物车</a>';
    } else {
      addButton = '<button type="button" disabled>暂不可购买</button>';
    }
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
      '<div class="row">' +
      '<a class="btn-link" href="#/products/' +
      esc(item.id) +
      '">查看详情</a>' +
      addButton +
      "</div>" +
      "</article>"
    );
  }

  function renderHome(context) {
    var renderStart = nowMs();
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>欢迎来到 Polaris Mall</h2>" +
      '<p class="text-muted">当前前端已完成路由、会话、权限守卫、商品浏览、购物车、下单支付、订单中心、容错与冒烟验收能力（W008）。</p>' +
      "<ul>" +
      "<li>商品页支持筛选、排序、分页与加入购物车</li>" +
      "<li>购物车页支持修改数量、删除与汇总金额展示</li>" +
      "<li>结算页支持地址选择与价格试算（接入 /api/v1/checkout/preview）</li>" +
      "<li>可从结算页提交订单，进入支付页模拟成功/失败并查看结果页</li>" +
      "<li>用户中心支持订单历史筛选分页、订单详情物流与退款申请展示</li>" +
      "<li>结算与支付关键链路支持加载骨架、失败可重试与回退引导</li>" +
      "<li>主链路已覆盖冒烟验证（浏览->加购->下单->查单）</li>" +
      "<li>未登录访问 <code>/cart</code>、<code>/checkout</code>、<code>/orders</code> 会跳转到登录页</li>" +
      "</ul>" +
      "</div>";
    trackRenderBudget("home", renderStart, 40);
  }

  function renderCatalog(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>商品列表</h2>" +
      '<p id="catalog-meta" class="text-muted">加载中...</p>' +
      '<p id="catalog-action-msg" class="text-muted"></p>' +
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
    var actionMsg = context.mount.querySelector("#catalog-action-msg");
    var list = context.mount.querySelector("#catalog-list");
    var controls = context.mount.querySelector("#catalog-controls");
    var pager = context.mount.querySelector("#catalog-pager");
    var prev = context.mount.querySelector("#catalog-prev");
    var next = context.mount.querySelector("#catalog-next");
    var keywordInput = context.mount.querySelector("#catalog-keyword");
    var categorySelect = context.mount.querySelector("#catalog-category");
    var stockSelect = context.mount.querySelector("#catalog-stock");
    var sortSelect = context.mount.querySelector("#catalog-sort");
    var canAdd = !!context.getSession().accessToken;

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

        function bindAddButtons() {
          var addButtons = list.querySelectorAll("[data-add-product-id]");
          for (var i = 0; i < addButtons.length; i += 1) {
            addButtons[i].addEventListener("click", function (event) {
              var productID = event.currentTarget.getAttribute("data-add-product-id");
              actionMsg.className = "text-muted";
              actionMsg.textContent = "加入中...";
              context.api
                .addCartItem({ product_id: productID, quantity: 1 })
                .then(function () {
                  actionMsg.textContent = "已加入购物车，可前往购物车继续操作。";
                })
                .catch(function (err) {
                  actionMsg.className = "text-danger";
                  actionMsg.textContent = err.message || "加入购物车失败";
                });
            });
          }
        }

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
              html.push(buildCatalogCard(pageData.items[idx], canAdd));
            }
            list.innerHTML = html.join("");
            if (canAdd) {
              bindAddButtons();
            }
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

        if (!canAdd) {
          actionMsg.textContent = "登录后可直接加入购物车。";
        }
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
    var canAdd = !!context.getSession().accessToken;
    var renderStart = nowMs();
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>商品详情</h2>" +
      '<p id="detail-msg" class="text-muted">加载中...</p>' +
      '<div id="detail-body"></div>' +
      '<p id="detail-action-msg" class="text-muted"></p>' +
      '<a class="btn-link" href="#/products">返回商品列表</a>' +
      "</div>";

    var msg = context.mount.querySelector("#detail-msg");
    var body = context.mount.querySelector("#detail-body");
    var actionMsg = context.mount.querySelector("#detail-action-msg");
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
          "</ul>" +
          '<div class="row" id="detail-action-row"></div>';

        var row = context.mount.querySelector("#detail-action-row");
        if (!canAdd) {
          row.innerHTML = '<a class="btn-link" href="#/login">登录后加入购物车</a>';
          return;
        }
        if (item.stock <= 0) {
          row.innerHTML = '<button type="button" disabled>暂不可购买</button>';
          return;
        }
        row.innerHTML = '<button id="detail-add-cart" class="btn-primary" type="button">加入购物车</button>';
        context.mount.querySelector("#detail-add-cart").addEventListener("click", function () {
          actionMsg.className = "text-muted";
          actionMsg.textContent = "加入中...";
          context.api
            .addCartItem({ product_id: item.id, quantity: 1 })
            .then(function () {
              actionMsg.textContent = "加入成功，可前往购物车查看。";
            })
            .catch(function (err) {
              actionMsg.className = "text-danger";
              actionMsg.textContent = err.message || "加入购物车失败";
            });
        });
        trackRenderBudget("productDetail", renderStart, 800);
      })
      .catch(function (err) {
        msg.className = "text-danger";
        msg.textContent = err.message || "加载失败";
        body.innerHTML = "";
        trackRenderBudget("productDetail", renderStart, 800);
      });
  }

  function renderCart(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>购物车</h2>" +
      '<p id="cart-msg" class="text-muted">加载中...</p>' +
      '<div id="cart-body"></div>' +
      "</div>";
    var msg = context.mount.querySelector("#cart-msg");
    var body = context.mount.querySelector("#cart-body");

    function renderCartBody(payload) {
      var items = payload.items || [];
      var summary = payload.summary || {};
      if (!items.length) {
        body.innerHTML =
          '<p class="text-muted">购物车为空，去 <a href="#/products">商品页</a> 添加商品吧。</p>';
        msg.textContent = "暂无商品";
        return;
      }

      var html = [];
      html.push('<table class="cart-table"><thead><tr><th>商品</th><th>单价</th><th>数量</th><th>小计</th><th>操作</th></tr></thead><tbody>');
      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        html.push(
          "<tr>" +
            "<td>" +
            esc(item.name) +
            "</td>" +
            "<td>" +
            formatPrice(item.price_cents) +
            "</td>" +
            "<td><input class=\"qty-input\" data-qty-id=\"" +
            esc(item.product_id) +
            "\" type=\"number\" min=\"1\" value=\"" +
            esc(item.quantity) +
            "\" /></td>" +
            "<td>" +
            formatPrice(item.line_total_cents) +
            "</td>" +
            "<td>" +
            '<button type="button" data-update-id="' +
            esc(item.product_id) +
            '">更新</button> ' +
            '<button type="button" data-remove-id="' +
            esc(item.product_id) +
            '">删除</button>' +
            "</td>" +
            "</tr>"
        );
      }
      html.push("</tbody></table>");
      html.push(
        '<div class="checkout-panel">' +
          "<p>商品数: " +
          esc(summary.total_items) +
          "，总件数: " +
          esc(summary.total_quantity) +
          "</p>" +
          "<p>合计: " +
          formatPrice(summary.total_amount_cents) +
          "</p>" +
          '<button id="go-checkout" class="btn-primary" type="button">去结算页</button>' +
          "</div>"
      );
      body.innerHTML = html.join("");
      msg.textContent = "购物车已更新";

      var updateButtons = body.querySelectorAll("[data-update-id]");
      for (var u = 0; u < updateButtons.length; u += 1) {
        updateButtons[u].addEventListener("click", function (event) {
          var productID = event.currentTarget.getAttribute("data-update-id");
          var qtyInput = body.querySelector('[data-qty-id="' + productID + '"]');
          var qty = toNonNegativeInt(qtyInput && qtyInput.value);
          if (qty <= 0) {
            msg.className = "text-danger";
            msg.textContent = "数量必须大于 0";
            return;
          }
          msg.className = "text-muted";
          msg.textContent = "更新中...";
          context.api
            .updateCartItem(productID, qty)
            .then(loadCart)
            .catch(function (err) {
              msg.className = "text-danger";
              msg.textContent = err.message || "更新购物车失败";
            });
        });
      }

      var removeButtons = body.querySelectorAll("[data-remove-id]");
      for (var r = 0; r < removeButtons.length; r += 1) {
        removeButtons[r].addEventListener("click", function (event) {
          var productID = event.currentTarget.getAttribute("data-remove-id");
          msg.className = "text-muted";
          msg.textContent = "删除中...";
          context.api
            .removeCartItem(productID)
            .then(loadCart)
            .catch(function (err) {
              msg.className = "text-danger";
              msg.textContent = err.message || "删除购物车失败";
            });
        });
      }

      var checkoutButton = body.querySelector("#go-checkout");
      if (checkoutButton) {
        checkoutButton.addEventListener("click", function () {
          context.navigate("/checkout");
        });
      }
    }

    function loadCart() {
      context.api
        .getCart()
        .then(renderCartBody)
        .catch(function (err) {
          msg.className = "text-danger";
          msg.textContent = err.message || "加载购物车失败";
          body.innerHTML = "";
        });
    }

    loadCart();
  }

  function renderCheckout(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>结算预览</h2>" +
      '<p id="checkout-msg" class="text-muted">加载中...</p>' +
      '<div id="checkout-body"></div>' +
      "</div>";
    var msg = context.mount.querySelector("#checkout-msg");
    var body = context.mount.querySelector("#checkout-body");

    function renderSkeleton() {
      body.innerHTML =
        '<div class="checkout-panel">' +
        '<div class="skeleton-line w-30"></div>' +
        '<div class="skeleton-line w-90"></div>' +
        '<div class="skeleton-line w-70"></div>' +
        '<div class="skeleton-line w-50"></div>' +
        "</div>";
    }

    function renderEmpty() {
      body.innerHTML =
        '<p class="text-muted">购物车为空，去 <a href="#/products">商品页</a> 添加商品后再结算。</p>';
      msg.textContent = "暂无可结算商品";
    }

    function renderLoadError(err) {
      var transient = isTransientError(err);
      msg.className = "text-danger";
      msg.textContent = transient ? "加载结算信息失败，可重试。" : err.message || "加载结算信息失败";
      body.innerHTML =
        '<div class="status-panel">' +
        '<p class="text-danger">' +
        esc(err && err.message ? err.message : "网络请求失败") +
        "</p>" +
        '<div class="row">' +
        '<button id="checkout-retry-load" type="button">重试加载</button>' +
        '<button id="checkout-to-cart" type="button">返回购物车</button>' +
        "</div>" +
        "</div>";
      var retry = body.querySelector("#checkout-retry-load");
      if (retry) {
        retry.addEventListener("click", loadCheckoutData);
      }
      var toCart = body.querySelector("#checkout-to-cart");
      if (toCart) {
        toCart.addEventListener("click", function () {
          context.navigate("/cart");
        });
      }
    }

    function renderCheckoutForm(cartPayload) {
      var summary = (cartPayload && cartPayload.summary) || {};
      if (!summary.total_items) {
        renderEmpty();
        return;
      }

      body.innerHTML =
        '<div class="checkout-panel">' +
        "<h3>收货地址</h3>" +
        '<select id="checkout-address">' +
        '<option value="上海市-浦东新区-演示地址">上海市 浦东新区 演示地址</option>' +
        '<option value="北京市-朝阳区-演示地址">北京市 朝阳区 演示地址</option>' +
        '<option value="广州市-天河区-演示地址">广州市 天河区 演示地址</option>' +
        "</select>" +
        "<h3>费用参数</h3>" +
        '<label class="label" for="checkout-shipping">运费（分）</label>' +
        '<input id="checkout-shipping" type="number" min="0" value="0" />' +
        '<label class="label" for="checkout-discount">优惠（分）</label>' +
        '<input id="checkout-discount" type="number" min="0" value="0" />' +
        '<label class="label" for="checkout-coupon">优惠码</label>' +
        '<input id="checkout-coupon" type="text" value="" placeholder="可选" />' +
        '<div class="row">' +
        '<button id="checkout-preview" class="btn-primary" type="button">试算金额</button>' +
        '<button id="checkout-submit-order" type="button">提交订单并支付</button>' +
        "</div>" +
        '<div id="checkout-result" class="card"></div>' +
        "</div>";

      var result = body.querySelector("#checkout-result");
      result.innerHTML =
        "<p>购物车商品数: " +
        esc(summary.total_items) +
        "</p>" +
        "<p>购物车总件数: " +
        esc(summary.total_quantity) +
        "</p>" +
        "<p>商品小计: " +
        formatPrice(summary.total_amount_cents) +
        "</p>";

      function submitOrder() {
        msg.className = "text-muted";
        msg.textContent = "提交订单中...";
        context.api
          .createOrder({})
          .then(function (orderPayload) {
            var order = orderPayload.order || {};
            if (!order.id) {
              throw new Error("订单创建成功但未返回订单号");
            }
            msg.textContent = "订单已创建，正在发起支付...";
            return context.api.createPayment(order.id, "mockpay").then(function () {
              context.navigate("/payments/" + order.id);
            });
          })
          .catch(function (err) {
            msg.className = "text-danger";
            if (isTransientError(err)) {
              msg.textContent = "提交订单失败，可能是网络波动，可直接重试。";
              result.innerHTML =
                '<div class="status-panel">' +
                '<p class="text-danger">' +
                esc(err.message || "网络请求失败") +
                "</p>" +
                '<div class="row">' +
                '<button id="checkout-retry-submit" class="btn-primary" type="button">重试提交订单</button>' +
                '<button id="checkout-back-cart" type="button">返回购物车</button>' +
                "</div>" +
                "</div>";
              var retrySubmit = result.querySelector("#checkout-retry-submit");
              if (retrySubmit) {
                retrySubmit.addEventListener("click", submitOrder);
              }
              var backCart = result.querySelector("#checkout-back-cart");
              if (backCart) {
                backCart.addEventListener("click", function () {
                  context.navigate("/cart");
                });
              }
              return;
            }
            msg.textContent = err.message || "提交订单失败";
          });
      }

      body.querySelector("#checkout-preview").addEventListener("click", function () {
        var input = buildCheckoutPreviewInput({
          shipping_cents: body.querySelector("#checkout-shipping").value,
          discount_cents: body.querySelector("#checkout-discount").value,
          coupon_code: body.querySelector("#checkout-coupon").value,
        });
        var address = body.querySelector("#checkout-address").value;
        msg.className = "text-muted";
        msg.textContent = "试算中...";
        context.api
          .checkoutPreview(input)
          .then(function (payload) {
            var pricing = payload.pricing || {};
            result.innerHTML =
              "<h3>试算结果</h3>" +
              "<p>收货地址: " +
              esc(address) +
              "</p>" +
              "<p>商品小计: " +
              formatPrice(pricing.subtotal_cents) +
              "</p>" +
              "<p>运费: " +
              formatPrice(pricing.shipping_cents) +
              "</p>" +
              "<p>优惠: " +
              formatPrice(pricing.discount_cents) +
              "</p>" +
              "<p><strong>应付总额: " +
              formatPrice(pricing.total_cents) +
              "</strong></p>" +
              "<p class=\"text-muted\">trace_id: " +
              esc(payload.trace_id) +
              "</p>";
            msg.textContent = "试算完成，可继续下单流程。";
          })
          .catch(function (err) {
            msg.className = "text-danger";
            if (isTransientError(err)) {
              msg.textContent = "试算失败，网络可能波动，请重试。";
              return;
            }
            msg.textContent = err.message || "试算失败";
          });
      });

      body.querySelector("#checkout-submit-order").addEventListener("click", submitOrder);

      function bindEnterToPreview(selector) {
        var field = body.querySelector(selector);
        if (!field) {
          return;
        }
        field.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            event.preventDefault();
            body.querySelector("#checkout-preview").click();
          }
        });
      }

      bindEnterToPreview("#checkout-shipping");
      bindEnterToPreview("#checkout-discount");
      bindEnterToPreview("#checkout-coupon");

      msg.textContent = "请确认地址与费用参数。";
    }

    function loadCheckoutData() {
      msg.className = "text-muted";
      msg.textContent = "加载中...";
      renderSkeleton();
      context.api
        .getCart()
        .then(renderCheckoutForm)
        .catch(renderLoadError);
    }

    loadCheckoutData();
  }

  function renderPayment(context) {
    var orderID = context.params.orderId;
    var callbackSecret = global.POLARIS_MOCKPAY_CALLBACK_SECRET || "dev-pay-callback-secret";

    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>支付页面</h2>" +
      '<p id="payment-msg" class="text-muted">加载中...</p>' +
      '<div id="payment-body"></div>' +
      "</div>";
    var msg = context.mount.querySelector("#payment-msg");
    var body = context.mount.querySelector("#payment-body");

    function renderSkeleton() {
      body.innerHTML =
        '<div class="checkout-panel">' +
        '<div class="skeleton-line w-30"></div>' +
        '<div class="skeleton-line w-70"></div>' +
        '<div class="skeleton-line w-90"></div>' +
        "</div>";
    }

    function renderLoadError(err) {
      var transient = isTransientError(err);
      msg.className = "text-danger";
      msg.textContent = transient ? "加载支付状态失败，可重试。" : err.message || "加载支付状态失败";
      body.innerHTML =
        '<div class="status-panel">' +
        '<p class="text-danger">' +
        esc(err && err.message ? err.message : "网络请求失败") +
        "</p>" +
        '<div class="row">' +
        '<button id="payment-retry-load" type="button">重试加载</button>' +
        '<button id="payment-back-checkout" type="button">返回结算页</button>' +
        "</div>" +
        "</div>";
      var retry = body.querySelector("#payment-retry-load");
      if (retry) {
        retry.addEventListener("click", function () {
          loadStatus(false);
        });
      }
      var back = body.querySelector("#payment-back-checkout");
      if (back) {
        back.addEventListener("click", function () {
          context.navigate("/checkout");
        });
      }
    }

    function loadPaymentWithFallback() {
      return context.api.getPaymentByOrder(orderID).catch(function (err) {
        if (err && err.status === 404) {
          return { payment: null };
        }
        throw err;
      });
    }

    function renderPaymentBody(order, payment) {
      var orderStatus = order && order.status;
      var paymentStatus = payment && payment.status;
      var outcome = derivePaymentOutcome(orderStatus, paymentStatus);

      var html = [];
      html.push('<div class="checkout-panel">');
      html.push("<p>订单号: " + esc(orderID) + "</p>");
      html.push("<p>订单状态: " + esc(orderStatus || "-") + "</p>");
      html.push("<p>支付单号: " + esc((payment && payment.id) || "-") + "</p>");
      html.push("<p>支付状态: " + esc(paymentStatus || "pending") + "</p>");
      html.push("<p>应付金额: " + formatPrice((order && order.total_cents) || 0) + "</p>");
      html.push('<div class="row">');
      html.push('<button id="payment-refresh" type="button">刷新状态</button>');
      if (outcome === "pending") {
        html.push('<button id="payment-success" class="btn-primary" type="button">模拟支付成功</button>');
        html.push('<button id="payment-failed" type="button">模拟支付失败</button>');
      }
      if (outcome === "failed") {
        html.push('<button id="payment-retry" class="btn-primary" type="button">重试支付（模拟成功）</button>');
      }
      if (outcome === "success" || outcome === "failed") {
        html.push('<button id="payment-result" type="button">查看支付结果页</button>');
      }
      html.push("</div>");
      html.push("</div>");
      body.innerHTML = html.join("");

      var refresh = body.querySelector("#payment-refresh");
      if (refresh) {
        refresh.addEventListener("click", function () {
          loadStatus(false);
        });
      }
      var goResult = body.querySelector("#payment-result");
      if (goResult) {
        goResult.addEventListener("click", function () {
          context.navigate("/payment-result/" + orderID);
        });
      }
      var successButton = body.querySelector("#payment-success");
      if (successButton) {
        successButton.addEventListener("click", function () {
          triggerMockpay("success");
        });
      }
      var failedButton = body.querySelector("#payment-failed");
      if (failedButton) {
        failedButton.addEventListener("click", function () {
          triggerMockpay("failed");
        });
      }
      var retryButton = body.querySelector("#payment-retry");
      if (retryButton) {
        retryButton.addEventListener("click", function () {
          triggerMockpay("success");
        });
      }
    }

    function loadStatus(navigateWhenDone) {
      msg.className = "text-muted";
      msg.textContent = "刷新支付状态中...";
      renderSkeleton();
      Promise.all([context.api.getOrder(orderID), loadPaymentWithFallback()])
        .then(function (parts) {
          var order = parts[0].order || {};
          var payment = parts[1].payment || null;
          renderPaymentBody(order, payment);

          var outcome = derivePaymentOutcome(order.status, payment && payment.status);
          if (navigateWhenDone && outcome !== "pending") {
            context.navigate("/payment-result/" + orderID);
            return;
          }
          msg.textContent = "可继续支付或查看结果。";
        })
        .catch(renderLoadError);
    }

    function triggerMockpay(result) {
      var payload = createMockpayCallbackPayload(orderID, result);
      var payloadJSON = JSON.stringify(payload);
      msg.className = "text-muted";
      msg.textContent = "模拟回调中...";
      signMockpayPayload(callbackSecret, payloadJSON)
        .then(function (signature) {
          return context.api.mockpayCallback(payload, signature);
        })
        .then(function () {
          loadStatus(true);
        })
        .catch(function (err) {
          msg.className = "text-danger";
          if (isTransientError(err)) {
            msg.textContent = "回调请求失败，网络可能波动，请重试。";
            return;
          }
          msg.textContent = err.message || "模拟支付回调失败";
        });
    }

    loadStatus(false);
  }

  function renderPaymentResult(context) {
    var orderID = context.params.orderId;
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>支付结果</h2>" +
      '<p id="payment-result-msg" class="text-muted">加载中...</p>' +
      '<div id="payment-result-body"></div>' +
      "</div>";

    var msg = context.mount.querySelector("#payment-result-msg");
    var body = context.mount.querySelector("#payment-result-body");

    function renderSkeleton() {
      body.innerHTML =
        '<div class="checkout-panel">' +
        '<div class="skeleton-line w-30"></div>' +
        '<div class="skeleton-line w-70"></div>' +
        '<div class="skeleton-line w-50"></div>' +
        "</div>";
    }

    function renderLoadError(err) {
      var transient = isTransientError(err);
      msg.className = "text-danger";
      msg.textContent = transient ? "加载支付结果失败，可重试。" : err.message || "加载支付结果失败";
      body.innerHTML =
        '<div class="status-panel">' +
        '<p class="text-danger">' +
        esc(err && err.message ? err.message : "网络请求失败") +
        "</p>" +
        '<div class="row">' +
        '<button id="payment-result-retry-load" type="button">重试加载</button>' +
        '<button id="payment-result-go-payment" type="button">返回支付页</button>' +
        "</div>" +
        "</div>";
      var retry = body.querySelector("#payment-result-retry-load");
      if (retry) {
        retry.addEventListener("click", loadResult);
      }
      var back = body.querySelector("#payment-result-go-payment");
      if (back) {
        back.addEventListener("click", function () {
          context.navigate("/payments/" + orderID);
        });
      }
    }

    function loadPaymentWithFallback() {
      return context.api.getPaymentByOrder(orderID).catch(function (err) {
        if (err && err.status === 404) {
          return { payment: null };
        }
        throw err;
      });
    }

    function renderResult(order, payment) {
      var outcome = derivePaymentOutcome(order && order.status, payment && payment.status);
      var html = [];
      html.push('<div class="checkout-panel">');
      html.push("<p>订单号: " + esc(orderID) + "</p>");
      html.push("<p>订单状态: " + esc((order && order.status) || "-") + "</p>");
      html.push("<p>支付状态: " + esc((payment && payment.status) || "pending") + "</p>");
      html.push("<p>应付金额: " + formatPrice((order && order.total_cents) || 0) + "</p>");

      if (outcome === "success") {
        html.push("<h3>支付成功</h3>");
        html.push('<p class="text-muted">订单已进入已支付状态，可继续履约流程。</p>');
        html.push('<div class="row"><button id="payment-result-account" class="btn-primary" type="button">进入账号中心</button></div>');
        msg.textContent = "支付成功";
        msg.className = "text-muted";
      } else if (outcome === "failed") {
        html.push("<h3>支付失败</h3>");
        html.push('<p class="text-danger">支付未完成，可返回支付页重试。</p>');
        html.push('<div class="row"><button id="payment-result-retry" class="btn-primary" type="button">返回支付页重试</button></div>');
        msg.textContent = "支付失败";
        msg.className = "text-danger";
      } else {
        html.push("<h3>支付处理中</h3>");
        html.push('<p class="text-muted">支付状态仍在处理中，可稍后刷新或返回支付页。</p>');
        html.push(
          '<div class="row">' +
            '<button id="payment-result-refresh" type="button">刷新状态</button>' +
            '<button id="payment-result-back" class="btn-primary" type="button">返回支付页</button>' +
            "</div>"
        );
        msg.textContent = "支付处理中";
        msg.className = "text-muted";
      }

      html.push("</div>");
      body.innerHTML = html.join("");

      var toAccount = body.querySelector("#payment-result-account");
      if (toAccount) {
        toAccount.addEventListener("click", function () {
          context.navigate("/account");
        });
      }
      var retry = body.querySelector("#payment-result-retry");
      if (retry) {
        retry.addEventListener("click", function () {
          context.navigate("/payments/" + orderID);
        });
      }
      var refresh = body.querySelector("#payment-result-refresh");
      if (refresh) {
        refresh.addEventListener("click", loadResult);
      }
      var back = body.querySelector("#payment-result-back");
      if (back) {
        back.addEventListener("click", function () {
          context.navigate("/payments/" + orderID);
        });
      }
    }

    function loadResult() {
      msg.className = "text-muted";
      msg.textContent = "加载中...";
      renderSkeleton();
      Promise.all([context.api.getOrder(orderID), loadPaymentWithFallback()])
        .then(function (parts) {
          renderResult(parts[0].order || {}, parts[1].payment || null);
        })
        .catch(renderLoadError);
    }

    loadResult();
  }

  function renderOrders(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>我的订单</h2>" +
      '<p id="orders-msg" class="text-muted">加载中...</p>' +
      '<div class="catalog-controls">' +
      '<select id="orders-status">' +
      '<option value="all">全部状态</option>' +
      '<option value="pending_payment">待支付</option>' +
      '<option value="paid">已支付</option>' +
      '<option value="shipped">已发货</option>' +
      '<option value="done">已完成</option>' +
      '<option value="canceled">已取消</option>' +
      "</select>" +
      "</div>" +
      '<div id="orders-list"></div>' +
      '<div id="orders-pager" class="row" hidden>' +
      '<button id="orders-prev" type="button">上一页</button>' +
      '<button id="orders-next" type="button">下一页</button>' +
      "</div>" +
      "</div>";

    var msg = context.mount.querySelector("#orders-msg");
    var statusSelect = context.mount.querySelector("#orders-status");
    var list = context.mount.querySelector("#orders-list");
    var pager = context.mount.querySelector("#orders-pager");
    var prev = context.mount.querySelector("#orders-prev");
    var next = context.mount.querySelector("#orders-next");
    var orders = [];
    var page = 1;
    var pageSize = 6;

    function renderList() {
      var filtered = filterOrdersByStatus(orders, statusSelect.value);
      var pageData = paginateList(filtered, page, pageSize);
      page = pageData.page;

      msg.textContent =
        "共 " +
        filtered.length +
        " 笔订单，第 " +
        pageData.page +
        "/" +
        pageData.totalPages +
        " 页";

      if (!filtered.length) {
        list.innerHTML = '<p class="text-muted">暂无符合条件的订单。</p>';
      } else {
        var html = [];
        html.push('<table class="cart-table"><thead><tr><th>订单号</th><th>状态</th><th>金额</th><th>更新时间</th><th>操作</th></tr></thead><tbody>');
        for (var i = 0; i < pageData.items.length; i += 1) {
          var item = pageData.items[i];
          html.push(
            "<tr>" +
              "<td>" +
              esc(item.id) +
              "</td>" +
              "<td>" +
              esc(item.status) +
              "</td>" +
              "<td>" +
              formatPrice(item.totalCents) +
              "</td>" +
              "<td>" +
              esc(item.updatedAt || "-") +
              "</td>" +
              "<td>" +
              '<button type="button" data-order-detail-id="' +
              esc(item.id) +
              '">查看详情</button>' +
              "</td>" +
              "</tr>"
          );
        }
        html.push("</tbody></table>");
        list.innerHTML = html.join("");

        var detailButtons = list.querySelectorAll("[data-order-detail-id]");
        for (var j = 0; j < detailButtons.length; j += 1) {
          detailButtons[j].addEventListener("click", function (event) {
            var id = event.currentTarget.getAttribute("data-order-detail-id");
            context.navigate("/orders/" + id);
          });
        }
      }

      pager.hidden = filtered.length <= pageSize;
      prev.disabled = pageData.page <= 1;
      next.disabled = pageData.page >= pageData.totalPages;
    }

    statusSelect.addEventListener("change", function () {
      page = 1;
      renderList();
    });
    prev.addEventListener("click", function () {
      page -= 1;
      renderList();
    });
    next.addEventListener("click", function () {
      page += 1;
      renderList();
    });

    context.api
      .listOrders()
      .then(function (payload) {
        orders = normalizeOrderItems(payload.items || []);
        renderList();
      })
      .catch(function (err) {
        msg.className = "text-danger";
        msg.textContent = err.message || "加载订单列表失败";
        list.innerHTML = "";
      });
  }

  function renderOrderDetail(context) {
    var orderID = context.params.id;
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>订单详情</h2>" +
      '<p id="order-detail-msg" class="text-muted">加载中...</p>' +
      '<div id="order-detail-body"></div>' +
      "</div>";

    var msg = context.mount.querySelector("#order-detail-msg");
    var body = context.mount.querySelector("#order-detail-body");

    function loadTrackingWithFallback() {
      return context.api.getOrderTracking(orderID).catch(function (err) {
        if (err && err.status === 404) {
          return { shipment: null };
        }
        throw err;
      });
    }

    function loadRefundWithFallback() {
      return context.api.getRefund(orderID).catch(function (err) {
        if (err && err.status === 404) {
          return { refund: null };
        }
        throw err;
      });
    }

    function renderDetail(order, shipment, refund) {
      var lines = Array.isArray(order.items) ? order.items : [];
      var html = [];
      html.push('<div class="checkout-panel">');
      html.push("<p>订单号: " + esc(order.id) + "</p>");
      html.push("<p>订单状态: " + esc(order.status) + "</p>");
      html.push("<p>创建时间: " + esc(order.created_at || "-") + "</p>");
      html.push("<p>更新时间: " + esc(order.updated_at || "-") + "</p>");
      html.push("<p>订单总额: " + formatPrice(order.total_cents) + "</p>");
      html.push("</div>");

      html.push('<div class="checkout-panel">');
      html.push("<h3>商品明细</h3>");
      if (!lines.length) {
        html.push('<p class="text-muted">暂无商品明细。</p>');
      } else {
        html.push('<table class="cart-table"><thead><tr><th>商品</th><th>单价</th><th>数量</th><th>小计</th></tr></thead><tbody>');
        for (var i = 0; i < lines.length; i += 1) {
          var line = lines[i];
          html.push(
            "<tr>" +
              "<td>" +
              esc(line.name) +
              "</td>" +
              "<td>" +
              formatPrice(line.price_cents) +
              "</td>" +
              "<td>" +
              esc(line.quantity) +
              "</td>" +
              "<td>" +
              formatPrice(line.line_total_cents) +
              "</td>" +
              "</tr>"
          );
        }
        html.push("</tbody></table>");
      }
      html.push("</div>");

      html.push('<div class="checkout-panel">');
      html.push("<h3>物流轨迹</h3>");
      if (!shipment) {
        html.push('<p class="text-muted">当前暂无物流信息。</p>');
      } else {
        html.push("<p>物流状态: " + esc(shipment.status) + "</p>");
        html.push("<p>承运商: " + esc(shipment.carrier) + "</p>");
        html.push("<p>运单号: " + esc(shipment.tracking_no) + "</p>");
        html.push("<p>发货时间: " + esc(shipment.shipped_at || "-") + "</p>");
        html.push("<p>签收时间: " + esc(shipment.delivered_at || "-") + "</p>");
      }
      html.push("</div>");

      html.push('<div class="checkout-panel">');
      html.push("<h3>退款信息</h3>");
      if (refund) {
        html.push("<p>退款单号: " + esc(refund.id) + "</p>");
        html.push("<p>退款状态: " + esc(refund.status) + "</p>");
        html.push("<p>退款金额: " + formatPrice(refund.amount_cents) + "</p>");
        html.push("<p>退款原因: " + esc(refund.reason) + "</p>");
      } else if (isRefundableOrderStatus(order.status)) {
        html.push('<label class="label" for="refund-amount">退款金额（分，留空按全额）</label>');
        html.push('<input id="refund-amount" type="number" min="0" value="" placeholder="例如 1000" />');
        html.push('<label class="label" for="refund-reason">退款原因</label>');
        html.push('<input id="refund-reason" type="text" value="buyer_request" />');
        html.push('<button id="refund-submit" class="btn-primary" type="button">提交退款申请</button>');
      } else {
        html.push('<p class="text-muted">当前订单状态不支持退款申请。</p>');
      }
      html.push("</div>");

      html.push('<div class="row"><button id="order-back" type="button">返回订单列表</button></div>');
      body.innerHTML = html.join("");

      var backButton = body.querySelector("#order-back");
      if (backButton) {
        backButton.addEventListener("click", function () {
          context.navigate("/orders");
        });
      }

      var refundButton = body.querySelector("#refund-submit");
      if (refundButton) {
        refundButton.addEventListener("click", function () {
          var amountInput = body.querySelector("#refund-amount");
          var reasonInput = body.querySelector("#refund-reason");
          var amount = toNonNegativeInt(amountInput && amountInput.value);
          var reason = reasonInput ? String(reasonInput.value || "").trim() : "";

          msg.className = "text-muted";
          msg.textContent = "提交退款申请中...";
          context.api
            .requestRefund(orderID, {
              amount_cents: amount,
              reason: reason,
            })
            .then(function () {
              msg.className = "text-muted";
              msg.textContent = "退款申请已提交。";
              loadDetail();
            })
            .catch(function (err) {
              msg.className = "text-danger";
              msg.textContent = err.message || "退款申请失败";
            });
        });
      }
    }

    function loadDetail() {
      msg.className = "text-muted";
      msg.textContent = "加载中...";
      Promise.all([context.api.getOrder(orderID), loadTrackingWithFallback(), loadRefundWithFallback()])
        .then(function (parts) {
          renderDetail(parts[0].order || {}, parts[1].shipment || null, parts[2].refund || null);
          msg.textContent = "订单信息已加载。";
        })
        .catch(function (err) {
          msg.className = "text-danger";
          msg.textContent = err.message || "加载订单详情失败";
          body.innerHTML = "";
        });
    }

    loadDetail();
  }

  function renderLogin(context) {
    context.mount.innerHTML =
      '<div class="card">' +
      "<h2>登录</h2>" +
      '<form id="login-form">' +
      '<label class="label" for="login-email">邮箱</label>' +
      '<input id="login-email" name="email" type="email" required placeholder="buyer@example.com" />' +
      '<label class="label" for="login-password">密码</label>' +
      '<input id="login-password" name="password" type="password" required placeholder="请输入密码" />' +
      '<button class="btn-primary" type="submit">登录</button>' +
      '<p id="login-msg" class="text-danger"></p>' +
      "</form>" +
      "</div>" +
      '<div class="card">' +
      "<h3>快速注册</h3>" +
      '<form id="register-form">' +
      '<label class="label" for="register-email">邮箱</label>' +
      '<input id="register-email" name="email" type="email" required placeholder="new@example.com" />' +
      '<label class="label" for="register-password">密码</label>' +
      '<input id="register-password" name="password" type="password" required placeholder="请输入密码" />' +
      '<label class="label" for="register-role">角色</label>' +
      '<input id="register-role" name="role" type="text" value="buyer" placeholder="buyer/admin/ops" />' +
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
    cart: renderCart,
    checkout: renderCheckout,
    payment: renderPayment,
    paymentResult: renderPaymentResult,
    orders: renderOrders,
    orderDetail: renderOrderDetail,
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
    buildCheckoutPreviewInput: buildCheckoutPreviewInput,
    createMockpayCallbackPayload: createMockpayCallbackPayload,
    derivePaymentOutcome: derivePaymentOutcome,
    normalizeOrderItems: normalizeOrderItems,
    filterOrdersByStatus: filterOrdersByStatus,
    paginateList: paginateList,
    isRefundableOrderStatus: isRefundableOrderStatus,
    isTransientError: isTransientError,
    isRenderWithinBudget: isRenderWithinBudget,
  };
})(window);
