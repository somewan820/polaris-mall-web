# Polaris Mall Web

Language: English | [中文](README.zh-CN.md)

`polaris-mall-web` contains the storefront shell baseline for W001-W008.

## Implemented In This Step

- route-based shell page
- persisted login session (`localStorage`)
- API client wrapper with normalized error handling
- route guards:
  - `/account` requires login
  - `/admin` requires admin role
- W002 catalog pages:
  - product list with keyword/category/stock filter
  - product sort (name, price, stock)
  - product pagination
  - product detail card view (price, stock, category, shelf status)
- W003 cart + checkout preview pages:
  - add to cart from list and detail pages
  - cart page supports quantity update/remove and summary amount
  - checkout preview page supports address selection and pricing trial (`/api/v1/checkout/preview`)
  - `/cart` and `/checkout` routes require login
- W004 order + payment flow pages:
  - checkout page supports submit order (`POST /api/v1/orders`) and payment creation (`POST /api/v1/payments/create`)
  - payment page supports mock success/failure callback and retry entry
  - payment result page supports success/failure state rendering and retry navigation
- W005 account order center pages:
  - order list page supports status filter and pagination
  - order detail page shows item lines and shipment status
  - refund apply form and refund status display are available on order detail
- W006 resilience UX for critical checkout flow:
  - checkout/payment/result pages include loading skeleton state
  - transient failures provide direct retry actions
  - unrecoverable failures provide explicit fallback navigation
- W007 performance + accessibility baseline:
  - home and product-detail render include runtime budget check hooks
  - checkout/login/register/refund fields use explicit label-to-control association
  - added bundle-size and runtime-budget checks in CI
- W008 verification baseline:
  - added deterministic e2e smoke test (`tests/e2e_smoke_test.js`)
  - smoke path covers browse -> add to cart -> order submit -> order query
  - smoke test integrated into CI gate
- starter pages:
  - home
  - product list (`/products`)
  - product detail (`/products/:id`)
  - cart (`/cart`)
  - checkout (`/checkout`)
  - payment (`/payments/:orderId`)
  - payment result (`/payment-result/:orderId`)
  - order list (`/orders`)
  - order detail (`/orders/:id`)
  - login/register
  - account profile
  - admin probe

## Local Run

Use any static file server. Example with Python:

```powershell
cd C:\Users\Some\Desktop\code_repo\polaris-mall-web
python -m SimpleHTTPServer 5173
```

Then open:

- `http://127.0.0.1:5173`

If your API runs on a different host, set in browser console before refresh:

```javascript
window.POLARIS_API_BASE_URL = "http://127.0.0.1:9000";
```

If callback secret differs from default `dev-pay-callback-secret`, set:

```javascript
window.POLARIS_MOCKPAY_CALLBACK_SECRET = "your-secret";
```

## Quick Verification

```powershell
node .\tests\router_guard_test.js
node .\tests\catalog_logic_test.js
node .\tests\checkout_payload_test.js
node .\tests\payment_logic_test.js
node .\tests\order_center_logic_test.js
node .\tests\resilience_logic_test.js
node .\tests\perf_budget_logic_test.js
node .\tests\bundle_budget_test.js
node .\tests\e2e_smoke_test.js
```

Optional seed override:

```powershell
$env:SMOKE_SEED = "rc-001"
node .\tests\e2e_smoke_test.js
```

## CI/CD Gate

- workflow file: `.github/workflows/web-ci-cd.yml`
- deploy job runs only on `push` to `main` and only after `gate` success
