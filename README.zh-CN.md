# Polaris Mall Web

语言：中文 | [English](README.md)

`polaris-mall-web` 是 Polaris Mall 前端仓库，当前覆盖 W001-W007 能力。

## 当前已实现

- W001 基线：
  - 路由壳子与页面骨架
  - 登录会话持久化（`localStorage`）
  - 统一 API 请求封装与错误归一化
  - 路由权限守卫（`/account` 需登录，`/admin` 需管理员）
- W002 基线：
  - 商品列表页筛选（关键词/分类/库存状态）
  - 商品列表页排序（名称/价格/库存）
  - 商品列表页分页
  - 商品详情页（价格、库存、分类、上架状态）
  - 商品筛选/分页纯逻辑测试
- W003 基线：
  - 商品列表页和详情页支持加入购物车
  - 购物车页支持数量更新、删除、金额汇总
  - 结算预览页支持地址选择与价格试算（`/api/v1/checkout/preview`）
  - `/cart`、`/checkout` 路由要求登录
- W004 基线：
  - 结算页支持提交订单（`POST /api/v1/orders`）并创建支付单（`POST /api/v1/payments/create`）
  - 支付页支持 mock 成功/失败回调与失败重试入口
  - 支付结果页支持成功/失败状态渲染与返回重试
- W005 基线：
  - 订单列表页支持状态筛选与分页
  - 订单详情页展示商品明细与物流状态
  - 订单详情页支持退款申请与退款状态展示
- W006 基线：
  - 结算页/支付页/支付结果页补充加载骨架状态
  - 网络抖动等瞬时失败场景支持一键重试
  - 不可恢复失败场景提供明确回退路径
- W007 基线：
  - 首页与商品详情页接入运行时渲染预算检查
  - 结算/登录/注册/退款输入域补充 label 关联以提升可访问性
  - 新增 bundle 与运行时预算检测并接入 CI

## 本地运行

可使用任意静态文件服务器。示例：

```powershell
cd C:\Users\Some\Desktop\code_repo\polaris-mall-web
python -m SimpleHTTPServer 5173
```

然后访问：

- `http://127.0.0.1:5173`

如果 API 地址不同，可在浏览器控制台设置后刷新：

```javascript
window.POLARIS_API_BASE_URL = "http://127.0.0.1:9000";
```

如果回调密钥不是默认值 `dev-pay-callback-secret`，可设置：

```javascript
window.POLARIS_MOCKPAY_CALLBACK_SECRET = "your-secret";
```

## 快速验证

```powershell
node .\tests\router_guard_test.js
node .\tests\catalog_logic_test.js
node .\tests\checkout_payload_test.js
node .\tests\payment_logic_test.js
node .\tests\order_center_logic_test.js
node .\tests\resilience_logic_test.js
node .\tests\perf_budget_logic_test.js
node .\tests\bundle_budget_test.js
```

## CI/CD Gate

- 工作流文件：`.github/workflows/web-ci-cd.yml`
- 部署任务仅在 `main` 分支 push 且 `gate` 成功后执行
