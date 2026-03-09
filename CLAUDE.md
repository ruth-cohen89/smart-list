# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server with hot reload (ts-node-dev)

# Build & Production
npm run build        # Compile TypeScript to dist/
npm run clean        # Remove dist/
npm start            # Run compiled production server

# Code Quality
npm run lint         # Check for ESLint errors
npm run lint:fix     # Auto-fix ESLint errors
npm run format       # Format with Prettier
```

No test suite is configured yet.

## Architecture

Layered architecture with strict separation of concerns:

```
Route → Controller → Service → Repository → Mongoose Model
```

- **Routes** (`src/routes/`): Define endpoints and apply middleware. Aggregated in `main.routes.ts` under `/api/v1/`.
- **Controllers** (`src/controllers/`): Parse request, call service, send response. No business logic.
- **Services** (`src/services/`): All business logic lives here.
- **Repositories** (`src/repositories/`): All database queries. Services never touch Mongoose directly.
- **Infrastructure** (`src/infrastructure/`): Mongoose models, MongoDB connection, OCR provider, and PDF utilities.
- **Models** (`src/models/`): TypeScript interfaces (domain types, not Mongoose schemas).
- **Types** (`src/types/`): Shared type definitions including `express.d.ts` for extending `req`/`res`.
- **Mappers** (`src/mappers/`): Transform between DB documents and domain types.
- **Validations** (`src/validations/`): Zod schemas used by the `validate-body` middleware.
- **Utils** (`src/utils/`): Stateless helpers. `jwt.ts` for signing/verifying tokens; `normalize.ts` for Hebrew/Unicode name normalization.
- **Errors** (`src/errors/`): `AppError` class plus handlers that normalize Mongoose and JWT errors for the global error middleware.

## Project Structure

```
src/
├── app.ts                          # Express app factory (middleware, routes, error handler)
├── server.ts                       # HTTP server entry point
│
├── routes/
│   ├── main.routes.ts              # Aggregates all routers under /api/v1/
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   ├── shopping-list.routes.ts
│   ├── consumption-profile.routes.ts
│   ├── receipts.routes.ts          # multer upload + receipt endpoints
│   └── health.routes.ts
│
├── controllers/
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── shopping-list.controller.ts
│   ├── consumption-profile.controller.ts
│   └── receipt.controller.ts
│
├── services/
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── shopping-list.service.ts
│   ├── consumption-profile.service.ts
│   ├── receipt.service.ts          # OCR orchestration + item parsing
│   └── receipt-match.service.ts   # Fuzzy matching + confirm-matches logic
│
├── repositories/
│   ├── auth.repository.ts
│   ├── user.repository.ts
│   ├── shopping-list.repository.ts
│   ├── consumption-profile.repository.ts
│   └── receipt.repository.ts
│
├── infrastructure/
│   ├── db/
│   │   ├── mongo.ts                        # MongoDB connection
│   │   ├── user.mongoose.model.ts
│   │   ├── shopping-list.mongoose.model.ts
│   │   ├── consumption-profile.mongoose.model.ts
│   │   └── receipt.mongoose.model.ts
│   ├── ocr/
│   │   └── google-vision-ocr.provider.ts  # Google Vision API integration
│   └── pdf/
│       └── pdf-to-images.ts               # pdfjs-dist + @napi-rs/canvas PDF renderer
│
├── models/                         # Domain interfaces (not Mongoose schemas)
│   ├── user.model.ts
│   ├── shopping-list.model.ts
│   ├── consumption-profile.model.ts
│   └── receipt.model.ts
│
├── mappers/
│   ├── shopping-list.mapper.ts
│   ├── consumption-profile.mapper.ts
│   └── receipt.mapper.ts
│
├── validations/
│   ├── auth.schemas.ts
│   ├── user.validation.ts
│   ├── shopping-list.ts
│   ├── consumption-profile.ts
│   └── receipt.validation.ts
│
├── middlewares/
│   ├── authenticate.ts             # JWT verification; attaches req.user
│   ├── authorize.ts                # Role-based access control
│   ├── catch-async.ts              # Wraps async handlers for error forwarding
│   ├── validate-body.ts            # Zod schema validation for req.body
│   └── validate-object-id.ts      # MongoDB ObjectId param validation
│
├── types/
│   ├── express.d.ts                # Extends Express Request/Response
│   ├── auth.ts
│   ├── shopping-list.ts
│   ├── consumption-profile.ts
│   ├── User.ts
│   └── ocr-provider.ts            # OcrProvider interface
│
├── utils/
│   ├── jwt.ts                      # sign / verify helpers
│   └── normalize.ts               # normalizeName (Hebrew/Unicode)
│
└── errors/
    ├── app-error.ts               # AppError class
    ├── error-middleware.ts        # Global Express error handler
    ├── auth-handlers.ts           # JWT error normalization
    └── mongo-handlers.ts          # Mongoose error normalization
```

## API Endpoints

All routes are prefixed `/api/v1/`.

### Auth — `/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Register a new user (creates an empty shopping list) |
| POST | `/login` | Authenticate and receive a JWT |
| POST | `/forgot-password` | Request a password-reset token |
| POST | `/reset-password` | Reset password with token |
| PATCH | `/change-password` | Change password (authenticated) |

### Users — `/users`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Get current user profile |
| PATCH | `/me` | Update current user profile |

### Shopping List — `/shopping-lists`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/active` | Get the user's active shopping list |
| PATCH | `/active` | Update list-level fields |
| POST | `/active/items` | Add an item to the active list |
| PATCH | `/active/items/:itemId` | Update an item |
| DELETE | `/active/items/:itemId` | Delete an item |
| POST | `/active/items/:itemId/purchase` | Mark an item as purchased |

### Consumption Profile — `/consumption-profile`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get (or create) the user's consumption profile |
| PUT | `/` | Upsert profile from onboarding questionnaire |
| POST | `/baseline-items` | Add a single baseline item |
| DELETE | `/baseline-items/:itemId` | Delete a baseline item |

### Receipts — `/receipts`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload` | Upload receipt image or PDF; runs OCR and returns parsed items |
| GET | `/:receiptId` | Retrieve a previously scanned receipt |
| POST | `/:receiptId/match-items` | Fuzzy-match receipt items against shopping list and baseline |
| POST | `/:receiptId/confirm-matches` | Confirm (or override) matches; updates shopping list and baseline |

### Health — `/health`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Liveness check |

## Key Middleware

- `authenticate.ts` — Verifies JWT from `Authorization: Bearer` header or cookie; attaches user to `req.user` and `res.locals.user`.
- `authorize.ts` — Role-based access control after authentication.
- `catch-async.ts` — Wraps async route handlers to forward errors to the global error middleware.
- `validate-body.ts` — Validates `req.body` against a Zod schema.
- `validate-object-id.ts` — Validates MongoDB ObjectId route params.

## Error Handling

- Throw `AppError` (from `src/errors/app-error.ts`) for operational errors with an HTTP status code.
- `error-middleware.ts` is the global Express error handler — it handles `AppError`, JWT errors, and Mongoose errors automatically.
- Never let Mongoose or JWT errors bubble up raw; they are caught and normalized in `mongo-handlers.ts` and `auth-handlers.ts`.

## Main System Flows

### Authentication
1. `POST /auth/signup` → `AuthController` → `AuthService.signUp` → creates `User` + empty `ShoppingList` → returns JWT.
2. `POST /auth/login` → verifies password with bcrypt → returns JWT.
3. Every protected request goes through `authenticate` middleware which verifies the JWT and checks `passwordChangedAt` to invalidate stale tokens.

### Receipt OCR
1. Client uploads an image or PDF to `POST /receipts/upload` (multipart, field name `file` or `files`, max 20 MB).
2. `receipts.routes.ts` runs multer in memory storage, then calls `ReceiptController.uploadReceipt`.
3. **PDF path**: `pdf-to-images.ts` tries the text layer first (`extractPdfTextLayer`); if meaningful text is found it is parsed directly (zero OCR cost). Otherwise each page is rendered to a PNG buffer at 2× scale and sent to Google Vision.
4. **Image path**: buffer is sent directly to `GoogleVisionOcrProvider` (`documentTextDetection`).
5. `ReceiptService` receives the raw OCR text, detects receipt kind (DIGITAL / PHOTO / HYBRID via score-based heuristic), and routes to the appropriate parser.

### Receipt Parsing
- **`parseItemsDigital`**: block-based parser for `₪N` leading-price receipts. Extracts `totalPrice`, `unitPrice`, product name, and infers quantity. Deduplicates via a Set.
- **`parseItemsPrimary` / fallback**: line-by-line parser for standard receipts. Seeds product name from pure-name lines before the items zone.
- Shared utilities: `extractMultiplyLine` (qty × price patterns), `extractDiscountAmount` (leading/trailing minus), `isPromoLine` (promotion line detection), Hebrew stopword filtering, `isValidProductName` guard.
- Each extracted item gets a `normalizedName` via `normalizeName` (`src/utils/normalize.ts`).
- Parsed items and metadata are stored in the `Receipt` document (status: `SCANNED`).

### Matching Receipt Items
1. `POST /receipts/:receiptId/match-items` → `ReceiptMatchService.matchReceiptItems`.
2. For each receipt item the service fuzzy-matches against:
   - The user's active **shopping list** items.
   - The user's **consumption profile** baseline items.
3. Score thresholds: `≥ 0.9` → `autoApproved`; `≥ 0.7` → `pendingConfirmation`. A `shouldForcePending` guard prevents unsafe single-token auto-approvals.
4. `autoApproved` shopping-list matches are removed from the list immediately. `autoApproved` baseline matches have `lastPurchasedAt` updated immediately.
5. Response contains `matchedReceiptItems` and `unmatchedReceiptItems`. If no items are pending or unmatched the receipt is automatically set to `APPLIED`.

### Confirming Matches
1. `POST /receipts/:receiptId/confirm-matches` — client sends the user's decisions for `pendingConfirmation` items.
2. `ReceiptMatchService.confirmReceiptMatches` validates each `receiptItemId` / `shoppingListItemId` / `baselineItemId` tuple.
3. Confirmed shopping-list matches → item deleted from list. Confirmed baseline matches → `lastPurchasedAt` updated on the baseline item.
4. Receipt status set to `APPLIED`.

### Updating the Shopping List
- Items are added/edited via `POST /shopping-lists/active/items` and `PATCH /shopping-lists/active/items/:itemId`.
- `POST /shopping-lists/active/items/:itemId/purchase` marks an item as purchased and updates its `usageScore` and `lastPurchasedAt`.
- `ShoppingListService` coordinates with `ConsumptionProfileService` to keep the baseline in sync when purchases are made.

### Updating the Consumption Baseline
- Baseline is created empty on signup and populated via `PUT /consumption-profile` (questionnaire) or `POST /consumption-profile/baseline-items` (single item).
- `ReceiptMatchService` updates `lastPurchasedAt` on matched baseline items via `ConsumptionProfileRepository.markPurchasedByNormalizedName`.

## Domain

- **Shopping List**: One active list per user (enforced by unique index). Items have `name`, `category`, `quantity`, `unit`, `priority`, `purchased`, `usageScore`, and `lastPurchasedAt`.
- **Consumption Profile**: Stores a user's baseline items with `name`, `normalizedName`, `category`, `quantity`, `unit`, and `lastPurchasedAt`.
- **Receipt**: Stores OCR result and parsed items. Status: `SCANNED` → `APPLIED`. Items include `name`, `normalizedName`, `quantity`, `price`, and `category`.
- **Auth**: JWT-based. Tracks `passwordChangedAt` on the user to invalidate tokens issued before a password change.

## Infrastructure Details

### Google Vision OCR
- Provider: `src/infrastructure/ocr/google-vision-ocr.provider.ts`
- Implements the `OcrProvider` interface (`src/types/ocr-provider.ts`).
- Credentials resolved from `GOOGLE_VISION_CREDENTIALS` (JSON string env var), `GOOGLE_VISION_API_KEY`, or Application Default Credentials (ADC).
- Uses `documentTextDetection` for best Hebrew accuracy. Throws `AppError` 502 on Vision API failure.

### PDF Processing
- `src/infrastructure/pdf/pdf-to-images.ts` uses `pdfjs-dist` v5 + `@napi-rs/canvas`.
- `pdfjs-dist` v5 is ESM-only; loaded in CommonJS via a dynamic `import()` wrapped in `new Function(...)`.
- `DOMMatrix`, `ImageData`, and `Path2D` are polyfilled from `@napi-rs/canvas` before pdfjs initializes.
- Pages rendered at 2× scale for OCR quality. Maximum 10 pages processed.
- Exports `extractPdfTextLayer` (checks for meaningful text: > 200 chars + price patterns) to avoid unnecessary OCR.

## Environment

Two env files: `.env.development` and `.env.production`.

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | yes | `development` or `production` |
| `PORT` | yes | HTTP port |
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret for signing JWTs |
| `GOOGLE_VISION_CREDENTIALS` | no* | Service account JSON (stringified) |
| `GOOGLE_VISION_API_KEY` | no* | API key alternative to service account |

*One of the Google Vision credential options is required for receipt OCR.
