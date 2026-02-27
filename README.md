# Polaris Mall Web

Language: English | [中文](README.zh-CN.md)

`polaris-mall-web` contains the storefront shell baseline for W001-W003.

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
- starter pages:
  - home
  - product list (`/products`)
  - product detail (`/products/:id`)
  - cart (`/cart`)
  - checkout (`/checkout`)
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

## Quick Verification

```powershell
node .\tests\router_guard_test.js
node .\tests\catalog_logic_test.js
node .\tests\checkout_payload_test.js
```

## CI/CD Gate

- workflow file: `.github/workflows/web-ci-cd.yml`
- deploy job runs only on `push` to `main` and only after `gate` success
