# MERN to Spring Boot Migration Mapping

This document captures the complete backend analysis and the final Node.js to Spring Boot mapping.

## 1) Source Analyzed

- Node backend source of truth: `d:\smart bridge project\project files\server\src`
- Spring replacement: `d:\smart bridge project\spring_back`

## 2) Express Route to Spring Controller Mapping

All Node routes are preserved with the same HTTP methods and API paths.

| Node Route | Node Handler | Spring Controller Method |
|---|---|---|
| `GET /health` | inline handler | `HealthController.health` |
| `POST /api/auth/register` | `authController.register` | `AuthController.register` |
| `POST /api/auth/login` | `authController.login` | `AuthController.login` |
| `POST /api/auth/refresh` | `authController.refresh` | `AuthController.refresh` |
| `POST /api/auth/logout` | `authController.logout` | `AuthController.logout` |
| `POST /api/auth/logout-all` | `authController.logoutAll` | `AuthController.logoutAll` |
| `GET /api/products/banners/home` | `productController.listHomeBanners` | `ProductController.listHomeBanners` |
| `GET /api/products` | `productController.listProducts` | `ProductController.listProducts` |
| `GET /api/products/by-id/:id` | `productController.getProductById` | `ProductController.getProductById` |
| `GET /api/products/:slug` | `productController.getProductBySlug` | `ProductController.getProductBySlug` |
| `GET /api/public/delivery-slots` | `publicController.listDeliverySlots` | `PublicController.listDeliverySlots` |
| `GET /api/public/home-featured` | `publicController.getHomeFeaturedConfig` | `PublicController.getHomeFeaturedConfig` |
| `GET /api/public/delivery-availability/:pincode` | `publicController.checkDeliveryAvailability` | `PublicController.checkDeliveryAvailability` |
| `POST /api/public/newsletter` | `publicController.subscribeNewsletter` | `PublicController.subscribeNewsletter` |
| `POST /api/public/support` | `publicController.createSupportTicket` | `PublicController.createSupportTicket` |
| `POST /api/public/support/authenticated` | `publicController.createSupportTicket` | `PublicController.createSupportTicketAuthenticated` |
| `GET /api/meta/categories/root` | `catalogMetaController.listRootCategories` | `CatalogMetaController.listRootCategories` |
| `GET /api/meta/categories/by-slug/:slug` | `catalogMetaController.getCategoryBySlug` | `CatalogMetaController.getCategoryBySlug` |
| `GET /api/meta/categories/:parentId/subcategories` | `catalogMetaController.listSubcategories` | `CatalogMetaController.listSubcategories` |
| `GET /api/meta/brands/featured` | `catalogMetaController.listFeaturedBrands` | `CatalogMetaController.listFeaturedBrands` |
| `GET /api/offers` | `offerController.getOffersPage` | `OfferController.getOffersPage` |
| `GET /api/offers/help-content` | `offerController.getHelpContent` | `OfferController.getHelpContent` |
| `POST /api/payments/webhook` | `paymentController.webhook` | `PaymentController.webhook` |
| `POST /api/payments/create-order` | `paymentController.createGatewayOrder` | `PaymentController.createGatewayOrder` |
| `POST /api/payments/refund` | `paymentController.initiateRefund` | `PaymentController.initiateRefund` |
| `GET /api/cart` | `cartController.getCart` | `CartController.getCart` |
| `POST /api/cart/items` | `cartController.addItem` | `CartController.addItem` |
| `PATCH /api/cart/items` | `cartController.updateItem` | `CartController.updateItem` |
| `DELETE /api/cart/items` | `cartController.removeItem` | `CartController.removeItem` |
| `POST /api/cart/coupon` | `cartController.applyCoupon` | `CartController.applyCoupon` |
| `DELETE /api/cart/coupon` | `cartController.clearCoupon` | `CartController.clearCoupon` |
| `GET /api/account/me` | `accountController.getProfile` | `AccountController.getProfile` |
| `PATCH /api/account/me` | `accountController.updateProfile` | `AccountController.updateProfile` |
| `PATCH /api/account/me/notifications` | `accountController.updateNotifications` | `AccountController.updateNotifications` |
| `PUT /api/account/me/addresses` | `accountController.updateAddresses` | `AccountController.updateAddresses` |
| `GET /api/account/me/sessions` | `accountController.listSessions` | `AccountController.listSessions` |
| `PATCH /api/account/me/two-factor` | `accountController.setTwoFactor` | `AccountController.setTwoFactor` |
| `GET /api/account/me/cards` | `accountController.listSavedCards` | `AccountController.listSavedCards` |
| `POST /api/account/me/cards` | `accountController.addSavedCard` | `AccountController.addSavedCard` |
| `DELETE /api/account/me/cards/:cardId` | `accountController.removeSavedCard` | `AccountController.removeSavedCard` |
| `PATCH /api/account/me/cards/:cardId/default` | `accountController.setDefaultCard` | `AccountController.setDefaultCard` |
| `POST /api/account/me/change-password` | `accountController.changePassword` | `AccountController.changePassword` |
| `POST /api/account/me/logout-all` | `accountController.logoutAllDevices` | `AccountController.logoutAllDevices` |
| `POST /api/account/me/data-download` | `accountController.requestDataDownload` | `AccountController.requestDataDownload` |
| `POST /api/account/me/profile-otp/request` | `accountController.requestProfileOtp` | `AccountController.requestProfileOtp` |
| `POST /api/account/me/profile-otp/verify` | `accountController.verifyProfileOtp` | `AccountController.verifyProfileOtp` |
| `POST /api/account/me/delete-request` | `accountController.requestDeletion` | `AccountController.requestDeletion` |
| `POST /api/account/me/recently-viewed` | `accountController.addRecentlyViewed` | `AccountController.addRecentlyViewed` |
| `GET /api/account/me/recently-viewed` | `accountController.listRecentlyViewed` | `AccountController.listRecentlyViewed` |
| `GET /api/wishlist` | `wishlistController.listWishlist` | `WishlistController.listWishlist` |
| `POST /api/wishlist/items` | `wishlistController.addWishlistItem` | `WishlistController.addWishlistItem` |
| `DELETE /api/wishlist/items` | `wishlistController.removeWishlistItem` | `WishlistController.removeWishlistItem` |
| `POST /api/wishlist/notify-stock` | `wishlistController.subscribeStockAlert` | `WishlistController.subscribeStockAlert` |
| `GET /api/orders/my` | `orderController.listMyOrders` | `OrderController.listMyOrders` |
| `GET /api/orders/my-groups` | `orderController.listMyOrderGroups` | `OrderController.listMyOrderGroups` |
| `GET /api/orders/groups/:orderGroupId` | `orderController.getByOrderGroupId` | `OrderController.getByOrderGroupId` |
| `POST /api/orders/groups/:orderGroupId/cancel` | `orderController.cancelOrderGroup` | `OrderController.cancelOrderGroup` |
| `POST /api/orders/groups/:orderGroupId/refund/initiate` | `orderController.initiateGroupRefund` | `OrderController.initiateGroupRefund` |
| `POST /api/orders/groups/:orderGroupId/refund/settle` | `orderController.settleGroupRefund` | `OrderController.settleGroupRefund` |
| `GET /api/orders/:orderId` | `orderController.getByOrderId` | `OrderController.getByOrderId` |
| `POST /api/orders` | `orderController.placeOrder` | `OrderController.placeOrder` |
| `POST /api/orders/:orderId/confirm-payment` | `orderController.confirmPayment` | `OrderController.confirmPayment` |
| `PATCH /api/orders/:orderId/status` | `orderController.updateStatus` | `OrderController.updateStatus` |
| `GET /api/admin/dashboard/metrics` | `adminController.dashboardMetrics` | `AdminController.dashboardMetrics` |
| `GET /api/admin/dashboard/analytics` | `adminController.dashboardAnalytics` | `AdminController.dashboardAnalytics` |
| `GET /api/admin/orders` | `adminController.listOrders` | `AdminController.listOrders` |
| `GET /api/admin/inventory/low-stock` | `adminController.lowStockAlerts` | `AdminController.lowStockAlerts` |
| `GET /api/admin/inventory/movements` | `adminController.listStockMovements` | `AdminController.listStockMovements` |
| `GET /api/admin/users` | `adminController.listUsers` | `AdminController.listUsers` |
| `GET /api/admin/audit-logs` | `adminController.listAuditLogs` | `AdminController.listAuditLogs` |
| `PATCH /api/admin/users/:id/block` | `adminController.blockUser` | `AdminController.blockUser` |
| `PATCH /api/admin/users/:id/role` | `adminController.updateUserRole` | `AdminController.updateUserRole` |
| `GET /api/admin/products/csv-template` | `adminController.productCsvTemplate` | `AdminController.productCsvTemplate` |
| `POST /api/admin/products/bulk-upload` | `adminController.createProductCsvUploadJob` | `AdminController.createProductCsvUploadJob` |
| `GET /api/admin/products/bulk-upload/:jobId` | `adminController.getProductCsvUploadJob` | `AdminController.getProductCsvUploadJob` |
| `GET /api/admin/products/bulk-upload/:jobId/failures` | `adminController.getCsvUploadFailureReport` | `AdminController.getCsvUploadFailureReport` |
| `GET /api/admin/inventory/stock-csv-template` | `adminController.stockCsvTemplate` | `AdminController.stockCsvTemplate` |
| `POST /api/admin/inventory/bulk-stock-upload` | `adminController.createStockCsvUploadJob` | `AdminController.createStockCsvUploadJob` |
| `PATCH /api/admin/inventory/threshold` | `adminController.updateLowStockThreshold` | `AdminController.updateLowStockThreshold` |
| `GET /api/admin/products/pending-approval` | `adminController.listPendingSellerProducts` | `AdminController.listPendingSellerProducts` |
| `PATCH /api/admin/products/:id/review` | `adminController.reviewSellerProduct` | `AdminController.reviewSellerProduct` |
| `POST /api/admin/products/upsert` | `adminCatalogController.upsertProduct` | `AdminCatalogController.upsertProduct` |
| `DELETE /api/admin/products/:id` | `adminCatalogController.deleteProduct` | `AdminCatalogController.deleteProduct` |
| `POST /api/admin/categories/upsert` | `adminCatalogController.upsertCategory` | `AdminCatalogController.upsertCategory` |
| `DELETE /api/admin/categories/:id` | `adminCatalogController.deleteCategory` | `AdminCatalogController.deleteCategory` |
| `POST /api/admin/coupons/upsert` | `adminCatalogController.upsertCoupon` | `AdminCatalogController.upsertCoupon` |
| `POST /api/admin/banners/upsert` | `adminCatalogController.upsertBanner` | `AdminCatalogController.upsertBanner` |
| `GET /api/admin/banners` | `adminController.listBanners` | `AdminController.listBanners` |
| `PATCH /api/admin/banners/reorder` | `adminController.reorderBanners` | `AdminController.reorderBanners` |
| `GET /api/admin/home-featured` | `adminController.getHomeFeaturedConfig` | `AdminController.getHomeFeaturedConfig` |
| `POST /api/admin/home-featured/upsert` | `adminController.upsertHomeFeaturedConfig` | `AdminController.upsertHomeFeaturedConfig` |
| `POST /api/admin/brands/upsert` | `adminCatalogController.upsertBrand` | `AdminCatalogController.upsertBrand` |
| `POST /api/admin/bundle-offers/upsert` | `adminCatalogController.upsertBundleOffer` | `AdminCatalogController.upsertBundleOffer` |
| `POST /api/admin/seasonal-sales/upsert` | `adminCatalogController.upsertSeasonalSale` | `AdminCatalogController.upsertSeasonalSale` |
| `POST /api/admin/policies/upsert` | `adminCatalogController.upsertPolicyContent` | `AdminCatalogController.upsertPolicyContent` |
| `GET /api/seller/dashboard` | `sellerController.dashboard` | `SellerController.dashboard` |
| `GET /api/seller/analytics` | `sellerController.analytics` | `SellerController.analytics` |
| `GET /api/seller/analytics/export` | `sellerController.analyticsExport` | `SellerController.analyticsExport` |
| `GET /api/seller/orders` | `sellerController.listSellerOrders` | `SellerController.listSellerOrders` |
| `GET /api/seller/orders/:orderId` | `sellerController.getSellerOrder` | `SellerController.getSellerOrder` |
| `GET /api/seller/products` | `sellerCatalogController.listProducts` | `SellerCatalogController.listProducts` |
| `POST /api/seller/products/upsert` | `sellerCatalogController.upsertProduct` | `SellerCatalogController.upsertProduct` |
| `PATCH /api/seller/inventory/stock` | `sellerCatalogController.updateStock` | `SellerCatalogController.updateStock` |
| `GET /api/seller/inventory/movements` | `sellerController.stockMovements` | `SellerController.stockMovements` |
| `GET /api/customer/home` | inline handler | `CustomerController.home` |
| `GET /api/user/home` | inline handler | `UserController.home` |
| `GET /api/reports/sales` | `reportController.salesReport` | `ReportController.salesReport` |
| `GET /api/reports/revenue` | `reportController.revenueReport` | `ReportController.revenueReport` |
| `GET /api/reports/product-performance` | `reportController.productPerformanceReport` | `ReportController.productPerformanceReport` |
| `GET /api/reports/customer-growth` | `reportController.customerGrowthReport` | `ReportController.customerGrowthReport` |
| `GET /api/reports/sales/export` | `reportController.exportSalesCsv` | `ReportController.exportSalesCsv` |
| `GET /api/reports/sales/export-pdf` | `reportController.exportSalesPdf` | `ReportController.exportSalesPdf` |
| `GET /api/reports/revenue/export` | `reportController.exportRevenueCsv` | `ReportController.exportRevenueCsv` |
| `GET /api/reports/customer-growth/export` | `reportController.exportCustomerGrowthCsv` | `ReportController.exportCustomerGrowthCsv` |
| `GET /api/reports/product-performance/export` | `reportController.exportProductPerformanceCsv` | `ReportController.exportProductPerformanceCsv` |

## 3) Controller and Service Mapping

| Node Controller | Spring Controller | Spring Service(s) |
|---|---|---|
| `authController` | `AuthController` | `AuthService`, `JwtService` |
| `productController` | `ProductController` | `CatalogService` |
| `publicController` | `PublicController` | `PublicService` |
| `catalogMetaController` | `CatalogMetaController` | `CatalogService` |
| `offerController` | `OfferController` | `OfferService` |
| `paymentController` | `PaymentController` | `PaymentService`, `PaymentGatewayService` |
| `cartController` | `CartController` | `CartService`, `PricingService`, `CouponService` |
| `accountController` | `AccountController` | `AccountService` |
| `wishlistController` | `WishlistController` | `WishlistService` |
| `orderController` | `OrderController` | `OrderService`, `ParentOrderService` |
| `adminController` | `AdminController` | `AdminService`, `AdminImportService` |
| `adminCatalogController` | `AdminCatalogController` | `CatalogAdminService`, `AuditLogService` |
| `sellerController` | `SellerController` | `SellerOperationsService` |
| `sellerCatalogController` | `SellerCatalogController` | `SellerCatalogService` |
| `reportController` | `ReportController` | `ReportService` |
| inline `customerRoutes` handler | `CustomerController` | `AuthContext` |
| inline `userRoutes` handler | `UserController` | `AuthContext` |

## 4) Mongoose Model to Spring Document Mapping

All 25 Mongoose models from Node are converted to Spring Data Mongo `@Document` classes with matching field names and IDs.

| Node Model | Spring Model | Mongo Collection |
|---|---|---|
| `AuditLog` | `AuditLog` | `auditlogs` |
| `Banner` | `Banner` | `banners` |
| `Brand` | `Brand` | `brands` |
| `BundleOffer` | `BundleOffer` | `bundleoffers` |
| `Cart` | `Cart` | `carts` |
| `Category` | `Category` | `categories` |
| `Coupon` | `Coupon` | `coupons` |
| `DeliverySlot` | `DeliverySlot` | `deliveryslots` |
| `HomeFeaturedConfig` | `HomeFeaturedConfig` | `homefeaturedconfigs` |
| `ImportJob` | `ImportJob` | `importjobs` |
| `Newsletter` | `Newsletter` | `newsletters` |
| `Order` | `Order` | `orders` |
| `ParentOrder` | `ParentOrder` | `parentorders` |
| `PaymentTransaction` | `PaymentTransaction` | `paymenttransactions` |
| `PolicyContent` | `PolicyContent` | `policycontents` |
| `ProcessedWebhookEvent` | `ProcessedWebhookEvent` | `processedwebhookevents` |
| `Product` | `Product` | `products` |
| `ProfileOtp` | `ProfileOtp` | `profileotps` |
| `RecentlyViewed` | `RecentlyViewed` | `recentlyvieweds` |
| `SeasonalSale` | `SeasonalSale` | `seasonalsales` |
| `StockAlertSubscription` | `StockAlertSubscription` | `stockalertsubscriptions` |
| `StockMovement` | `StockMovement` | `stockmovements` |
| `SupportTicket` | `SupportTicket` | `supporttickets` |
| `User` | `User` | `users` |
| `Wishlist` | `Wishlist` | `wishlists` |

## 5) Middleware Conversion Mapping

| Express Middleware | Purpose | Spring Equivalent |
|---|---|---|
| `authenticate` | JWT auth and active-user check | `JwtAuthenticationFilter` + `SecurityConfig` |
| `authorizeRoles(...)` | Role-based route guard | `SecurityConfig` path/role rules + role checks in service methods |
| `validate(...)` | Request validation with `express-validator` | Spring Validation + controller input guards + `GlobalExceptionHandler` for validation errors |
| `errorHandler` | Standard JSON error payload | `@ControllerAdvice` (`GlobalExceptionHandler`) |
| `notFound` | JSON 404 payload | `NoHandlerFoundException` handling in `GlobalExceptionHandler` |
| security middleware (CORS/helmet/rate-limit/sanitize) | request hardening | `SecurityConfig` CORS + Spring Security defaults; rate-limit/sanitize can be added as filters if needed |
| `compression` | gzip responses over 1KB | Spring server compression (`server.compression.*`) |

## 6) Authentication Logic (Node to Spring)

- Access token in `Authorization: Bearer <token>`.
- Refresh token lifecycle preserved (`/api/auth/refresh`, `/api/auth/logout`, `/api/auth/logout-all`).
- Authenticated user is resolved from JWT and loaded from Mongo, with account status checks.
- Role model preserved: `ADMIN`, `SELLER`, `CUSTOMER`.
- Route-level access preserved in `SecurityConfig`.

## 7) File Upload / Binary Payload Handling

- No multipart file upload routes were present in the analyzed Node source.
- CSV import endpoints accept `csvContent` text payload in JSON body (preserved).
- Payment webhook preserves raw body processing via `@RequestBody byte[]` and signature header handling.

## 8) Environment Variables Mapping

Node env keys identified and mapped to Spring properties/runtime env:

- Core: `PORT`, `MONGO_URI`
- JWT/Auth: `JWT_ACCESS_SECRET`/`JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `BCRYPT_SALT_ROUNDS`
- CORS/App: `CORS_WHITELIST`, `FRONTEND_BASE_URL`, `APP_NAME`, `LOG_LEVEL`
- Pricing/Inventory: `DEFAULT_DELIVERY_FEE`, `FREE_DELIVERY_THRESHOLD`, `TAX_PERCENT`, `LOW_STOCK_DEFAULT_THRESHOLD`
- Payment: `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`
- Messaging: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMS_WEBHOOK_URL`
- Public availability: `SERVICEABLE_PINCODES`

## 9) Database Structure Summary

Key data domains retained exactly:

- Identity and access: `users`, `profileotps`, `auditlogs`
- Catalog: `products`, `categories`, `brands`, `banners`, `bundleoffers`, `seasonalsales`, `policycontents`, `homefeaturedconfigs`
- Commerce: `carts`, `orders`, `parentorders`, `coupons`, `deliveryslots`
- Payment: `paymenttransactions`, `processedwebhookevents`
- Engagement/support: `wishlists`, `stockalertsubscriptions`, `recentlyvieweds`, `newsletters`, `supporttickets`
- Operations: `stockmovements`, `importjobs`

## 10) Validation Logic Conversion

Node validators (`express-validator` in `src/validators`) are mirrored by:

- Spring request parsing/guards at controller level for query/path/body.
- Domain checks in service layer (ownership, role, state transitions, stock, coupon validity, date ranges).
- Global standardized validation error response:
  - `success: false`
  - `code: "VALIDATION_FAILED"`
  - HTTP `422`
