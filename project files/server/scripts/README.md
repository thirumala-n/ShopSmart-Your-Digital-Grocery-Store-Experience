# Seed Credentials

The `seedMarketplace.js` script creates these accounts:

## Admin Account
- Email: `admin@gmail.com`
- Password: `admin123`

## Seller Account (1)
- Email: `seller.test@grocery.local`
- Password: `Seller@12345`

All are created with upsert and can be reseeded safely.

## Role Migration
- Command: `npm run migrate:roles`
- Purpose: migrate legacy `user` roles to strict `customer`/`seller`.

## Kaggle Dataset Import
- Command:
  - `npm run import:kaggle -- --path "<dataset-folder>"`
  - or `npm run import:kaggle -- --file "<dataset.csv>"`
- Dry run:
  - `npm run import:kaggle -- --path "<dataset-folder>" --dry-run`
- Notes:
  - Uses first/largest CSV in folder when `--path` is provided.
  - Upserts products using deterministic SKU (`KGL-<hash>`), so reruns are safe.
  - Auto-creates root/sub categories and brands.
  - Imports as active + admin approved.
