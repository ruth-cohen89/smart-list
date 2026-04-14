# CLAUDE.md

Prefer reusing and extending existing logic when appropriate.

## Commands

npm run dev
npm run build
npm run lint
npm run format

## Architecture

Layered:
Route → Controller → Service → Repository → Mongoose Model

Rules:

- Controllers: request/response only, no business logic
- Services: all business logic
- Repositories: DB only
- Services never access Mongoose directly
- Domain types in `src/models` (separate from Mongoose)
- Always reuse existing logic instead of duplicating

## Project Structure

- routes → `/api/v1` endpoints
- controllers → req → service → res
- services → business logic
- repositories → persistence
- infrastructure → DB / OCR / PDF / integrations
- models → domain types
- mappers → DB ↔ domain
- validations → Zod
- middlewares → auth / validation / errors
- utils → shared helpers
- errors → `AppError`

## Request & Error Conventions

- `authenticate` → adds `req.user`
- async controllers wrapped with `catchAsync`
- use Zod via `validate-body`
- validate Mongo ids with `validate-object-id`
- use `AppError` for operational errors
- never throw raw errors

## Core Flows

### Auth

- signup → user + empty shopping list + JWT
- login → verify + JWT
- protected routes require JWT + `passwordChangedAt` check

### Shopping List

- one active list per user
- CRUD items + purchase flow
- purchase updates usage and syncs with baseline

### Consumption Profile

- created on signup
- updated via receipts / questionnaire / manual

### Receipts / OCR

- upload via multer (memory)
- PDFs:
  - try text layer first
  - else render pages → Vision OCR
- images → Vision OCR directly
- flow:
  OCR/text → detect type → parse items → match → confirm
- status: `SCANNED` → `APPLIED`

### Matching

- sources: shopping list + baseline
- thresholds:
  - ≥0.9 → auto
  - ≥0.7 → pending
  - else → unmatched
- confirmed/auto:
  - remove from list
  - update baseline

## Domain

- Shopping List: 1 active per user
- Consumption Profile: long-term normalized data
- Receipt: extracted items (name, normalizedName, price, quantity)
- Auth: JWT-based, `passwordChangedAt` invalidates tokens

## Environment

Required:
NODE_ENV
PORT
MONGO_URI
JWT_SECRET

OCR (one required):
GOOGLE_VISION_CREDENTIALS
GOOGLE_VISION_API_KEY
ADC
