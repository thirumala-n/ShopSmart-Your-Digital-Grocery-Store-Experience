# API Endpoint Documentation

Base URL (local): `http://localhost:8080`

Auth roles:
- `Public`: no token
- `Auth`: any authenticated user
- `Customer`: authenticated user with `CUSTOMER`
- `Seller`: authenticated user with `SELLER`
- `Admin`: authenticated user with `ADMIN`

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness endpoint |

## Auth (`/api/auth`)

| Method | Path | Auth |
|---|---|---|
| POST | `/register` | Public |
| POST | `/login` | Public |
| POST | `/refresh` | Public |
| POST | `/logout` | Auth |
| POST | `/logout-all` | Auth |

## Products (`/api/products`)

| Method | Path | Auth |
|---|---|---|
| GET | `/banners/home` | Public |
| GET | `/` | Public |
| GET | `/by-id/{id}` | Public |
| GET | `/{slug}` | Public |

## Public (`/api/public`)

| Method | Path | Auth |
|---|---|---|
| GET | `/delivery-slots` | Public |
| GET | `/home-featured` | Public |
| GET | `/delivery-availability/{pincode}` | Public |
| POST | `/newsletter` | Public |
| POST | `/support` | Public |
| POST | `/support/authenticated` | Auth |

## Catalog Metadata (`/api/meta`)

| Method | Path | Auth |
|---|---|---|
| GET | `/categories/root` | Public |
| GET | `/categories/by-slug/{slug}` | Public |
| GET | `/categories/{parentId}/subcategories` | Public |
| GET | `/brands/featured` | Public |

## Offers (`/api/offers`)

| Method | Path | Auth |
|---|---|---|
| GET | `/` | Public |
| GET | `/help-content` | Public |

## Payments (`/api/payments`)

| Method | Path | Auth |
|---|---|---|
| POST | `/webhook` | Public |
| POST | `/create-order` | Customer |
| POST | `/refund` | Admin |

## Cart (`/api/cart`)

| Method | Path | Auth |
|---|---|---|
| GET | `/` | Customer |
| POST | `/items` | Customer |
| PATCH | `/items` | Customer |
| DELETE | `/items` | Customer |
| POST | `/coupon` | Customer |
| DELETE | `/coupon` | Customer |

## Account (`/api/account`)

| Method | Path | Auth |
|---|---|---|
| GET | `/me` | Auth |
| PATCH | `/me` | Auth |
| PATCH | `/me/notifications` | Auth |
| PUT | `/me/addresses` | Auth |
| GET | `/me/sessions` | Auth |
| PATCH | `/me/two-factor` | Auth |
| GET | `/me/cards` | Auth |
| POST | `/me/cards` | Auth |
| DELETE | `/me/cards/{cardId}` | Auth |
| PATCH | `/me/cards/{cardId}/default` | Auth |
| POST | `/me/change-password` | Auth |
| POST | `/me/logout-all` | Auth |
| POST | `/me/data-download` | Auth |
| POST | `/me/profile-otp/request` | Auth |
| POST | `/me/profile-otp/verify` | Auth |
| POST | `/me/delete-request` | Auth |
| POST | `/me/recently-viewed` | Auth |
| GET | `/me/recently-viewed` | Auth |

## Wishlist (`/api/wishlist`)

| Method | Path | Auth |
|---|---|---|
| GET | `/` | Customer |
| POST | `/items` | Customer |
| DELETE | `/items` | Customer |
| POST | `/notify-stock` | Customer |

## Orders (`/api/orders`)

| Method | Path | Auth |
|---|---|---|
| GET | `/my` | Auth |
| GET | `/my-groups` | Auth |
| GET | `/groups/{orderGroupId}` | Auth |
| POST | `/groups/{orderGroupId}/cancel` | Auth |
| POST | `/groups/{orderGroupId}/refund/initiate` | Auth |
| POST | `/groups/{orderGroupId}/refund/settle` | Auth |
| GET | `/{orderId}` | Auth |
| POST | `/` | Customer |
| POST | `/{orderId}/confirm-payment` | Auth |
| PATCH | `/{orderId}/status` | Auth |

## Admin (`/api/admin`)

| Method | Path | Auth |
|---|---|---|
| GET | `/dashboard/metrics` | Admin |
| GET | `/dashboard/analytics` | Admin |
| GET | `/orders` | Admin |
| GET | `/inventory/low-stock` | Admin |
| GET | `/inventory/movements` | Admin |
| GET | `/users` | Admin |
| GET | `/audit-logs` | Admin |
| PATCH | `/users/{id}/block` | Admin |
| PATCH | `/users/{id}/role` | Admin |
| GET | `/products/csv-template` | Admin |
| POST | `/products/bulk-upload` | Admin |
| GET | `/products/bulk-upload/{jobId}` | Admin |
| GET | `/products/bulk-upload/{jobId}/failures` | Admin |
| GET | `/inventory/stock-csv-template` | Admin |
| POST | `/inventory/bulk-stock-upload` | Admin |
| PATCH | `/inventory/threshold` | Admin |
| GET | `/products/pending-approval` | Admin |
| PATCH | `/products/{id}/review` | Admin |
| POST | `/products/upsert` | Admin |
| DELETE | `/products/{id}` | Admin |
| POST | `/categories/upsert` | Admin |
| DELETE | `/categories/{id}` | Admin |
| POST | `/coupons/upsert` | Admin |
| POST | `/banners/upsert` | Admin |
| GET | `/banners` | Admin |
| PATCH | `/banners/reorder` | Admin |
| GET | `/home-featured` | Admin |
| POST | `/home-featured/upsert` | Admin |
| POST | `/brands/upsert` | Admin |
| POST | `/bundle-offers/upsert` | Admin |
| POST | `/seasonal-sales/upsert` | Admin |
| POST | `/policies/upsert` | Admin |

## Seller (`/api/seller`)

| Method | Path | Auth |
|---|---|---|
| GET | `/dashboard` | Seller |
| GET | `/analytics` | Seller |
| GET | `/analytics/export` | Seller |
| GET | `/orders` | Seller |
| GET | `/orders/{orderId}` | Seller |
| GET | `/products` | Seller |
| POST | `/products/upsert` | Seller |
| PATCH | `/inventory/stock` | Seller |
| GET | `/inventory/movements` | Seller |

## Portal Home Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/customer/home` | Customer |
| GET | `/api/user/home` | Customer |

## Reports (`/api/reports`)

| Method | Path | Auth |
|---|---|---|
| GET | `/sales` | Admin |
| GET | `/revenue` | Admin |
| GET | `/product-performance` | Admin |
| GET | `/customer-growth` | Admin |
| GET | `/sales/export` | Admin |
| GET | `/sales/export-pdf` | Admin |
| GET | `/revenue/export` | Admin |
| GET | `/customer-growth/export` | Admin |
| GET | `/product-performance/export` | Admin |

## Example cURL Requests

Replace token placeholders as needed.

```bash
# 1) Health
curl -s http://localhost:8080/health

# 2) Register
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","phone":"9999999999","password":"StrongPass1!"}'

# 3) Login
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"StrongPass1!"}'

# 4) Product listing
curl -s "http://localhost:8080/api/products?page=1&pageSize=10&sortBy=relevance"

# 5) Product by slug
curl -s http://localhost:8080/api/products/fresh-bananas

# 6) Get cart
curl -s http://localhost:8080/api/cart \
  -H "Authorization: Bearer <CUSTOMER_ACCESS_TOKEN>"

# 7) Add cart item
curl -s -X POST http://localhost:8080/api/cart/items \
  -H "Authorization: Bearer <CUSTOMER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","variantId":"<VARIANT_ID>","quantity":2}'

# 8) Place order
curl -s -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <CUSTOMER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"shippingAddress":{"fullName":"Alice","phone":"9999999999","line1":"221B Baker St","city":"Bengaluru","state":"KA","pincode":"560001"},"paymentMethod":"COD"}'

# 9) Confirm payment
curl -s -X POST http://localhost:8080/api/orders/<ORDER_ID>/confirm-payment \
  -H "Authorization: Bearer <CUSTOMER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"paymentGatewayOrderId":"gw_123","paymentGatewayPaymentId":"pay_123"}'

# 10) Customer account profile
curl -s http://localhost:8080/api/account/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 11) Admin dashboard metrics
curl -s http://localhost:8080/api/admin/dashboard/metrics \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"

# 12) Admin catalog upsert product
curl -s -X POST http://localhost:8080/api/admin/products/upsert \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Apple","slug":"apple","SKU":"APP-001","brand":"Farm","categoryId":"<CATEGORY_ID>","subCategoryId":"<SUBCATEGORY_ID>","variants":[{"weight":"1kg","price":120,"MRP":140,"stock":100,"skuSuffix":"1KG"}]}'

# 13) Seller dashboard
curl -s http://localhost:8080/api/seller/dashboard \
  -H "Authorization: Bearer <SELLER_ACCESS_TOKEN>"

# 14) Seller stock update
curl -s -X PATCH http://localhost:8080/api/seller/inventory/stock \
  -H "Authorization: Bearer <SELLER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","variantId":"<VARIANT_ID>","stock":45}'

# 15) Admin sales report
curl -s "http://localhost:8080/api/reports/sales?fromDate=2026-01-01&toDate=2026-03-01" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>"
```
