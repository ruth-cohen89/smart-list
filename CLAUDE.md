# CLAUDE.md

Prefer reusing and extending existing logic when appropriate.

## Commands

npm run dev
npm run build
npm run clean
npm start
npm run lint
npm run lint:fix
npm run format

## Architecture

Layered:
Route → Controller → Service → Repository → Mongoose Model

Rules:

- Controllers: no business logic
- Services: all business logic
- Repositories: DB only
- Services never access Mongoose directly
- Domain types in src/models (separate from Mongoose)

## Structure

- routes → endpoints (/api/v1)
- controllers → req → service → res
- services → business logic
- repositories → DB
- infrastructure → DB, OCR, PDF
- models → domain types
- mappers → DB ↔ domain
- validations → Zod
- middlewares → auth, validation, errors
- utils → jwt, normalize
- errors → AppError + handlers

## API (/api/v1)

Auth:
POST /auth/signup
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
PATCH /auth/change-password

Users:
GET /users/me
PATCH /users/me

Shopping List:
GET /shopping-lists/active
PATCH /shopping-lists/active
POST /shopping-lists/active/items
PATCH /shopping-lists/active/items/:itemId
DELETE /shopping-lists/active/items/:itemId
POST /shopping-lists/active/items/:itemId/purchase

Consumption Profile:
GET /consumption-profile
PUT /consumption-profile
POST /consumption-profile/baseline-items
DELETE /consumption-profile/baseline-items/:itemId

Receipts:
POST /receipts/upload
GET /receipts/:receiptId
POST /receipts/:receiptId/match-items
POST /receipts/:receiptId/confirm-matches

Health:
GET /health

## Middleware

- authenticate → JWT → req.user
- authorize → roles
- validate-body → Zod
- validate-object-id → Mongo id
- catch-async → error forwarding

## Errors

- use AppError
- global handler handles AppError, JWT, Mongoose
- never throw raw errors

## Core Flows

Auth:
signup → user + empty list → JWT  
login → verify → JWT  
protected → JWT + passwordChangedAt check

OCR:
upload → multer (memory)

PDF:

- try text layer
- if meaningful → parse (no OCR)
- else → render 2x → Vision

Image:

- send directly to Vision

OCR → ReceiptService → detect type → parse

PDF rules:

- max 10 pages
- skip OCR if >200 chars + price patterns

OCR provider:

- Google Vision (documentTextDetection)
- credentials: ENV / API key / ADC
- failure → AppError 502

Parsing:

- parseItemsDigital
- parseItemsPrimary

Helpers:

- extractMultiplyLine
- extractDiscountAmount
- isPromoLine
- isValidProductName
- normalizeName

Behavior:

- extract name, quantity, price
- dedupe with Set
- add normalizedName
- status → SCANNED

Matching:

- sources: shopping list + baseline

Thresholds:

- ≥0.9 → autoApproved
- ≥0.7 → pending
- else → unmatched

Rules:

- use shouldForcePending
- auto:
  - remove from list
  - update baseline
- no pending → status APPLIED

Confirm:

- validate ids
- remove list items
- update baseline
- status APPLIED

Shopping List:

- CRUD items
- purchase → usageScore + lastPurchasedAt
- sync with baseline

Baseline:

- created on signup
- updated via questionnaire / receipts / manual

## Domain

Shopping List:

- 1 active per user
- fields:
  name, category, quantity, unit, priority, purchased, usageScore, lastPurchasedAt

Consumption Profile:

- fields:
  name, normalizedName, category, quantity, unit, lastPurchasedAt

Receipt:

- status: SCANNED → APPLIED
- items:
  name, normalizedName, quantity, price, category

Auth:

- JWT
- passwordChangedAt invalidates tokens

## ENV

Required:
NODE_ENV
PORT
MONGO_URI
JWT_SECRET

OCR (one required):
GOOGLE_VISION_CREDENTIALS
GOOGLE_VISION_API_KEY
ADC
