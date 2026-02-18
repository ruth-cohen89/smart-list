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
- **Infrastructure** (`src/infrastructure/db/`): Mongoose models and MongoDB connection (`mongo.ts`).
- **Models** (`src/models/`): TypeScript interfaces (domain types, not Mongoose schemas).
- **Types** (`src/types/`): Shared type definitions including `express.d.ts` for extending `req`/`res`.
- **Mappers** (`src/mappers/`): Transform between DB documents and domain types.
- **Validations** (`src/validations/`): Zod schemas used by `validate-body` middleware.

## Key Middleware

- `authenticate.ts` — Verifies JWT from `Authorization: Bearer` header or cookie, attaches user to `req.user` and `res.locals.user`.
- `authorize.ts` — Role-based access control after authentication.
- `catch-async.ts` — Wraps async route handlers to forward errors to the global error middleware.
- `validate-body.ts` — Validates `req.body` against a Zod schema.
- `validate-object-id.ts` — Validates MongoDB ObjectId route params.

## Error Handling

- Throw `AppError` (from `src/errors/app-error.ts`) for operational errors with an HTTP status code.
- `error-middleware.ts` is the global Express error handler — it handles `AppError`, JWT errors, and Mongoose errors automatically.
- Never let Mongoose or JWT errors bubble up raw; they are caught and normalized in `mongo-handlers.ts` and `auth-handlers.ts`.

## Domain

- **Shopping List**: One active list per user (enforced by unique index). Items have name, category, quantity, unit, priority, purchased flag, usageScore, and lastPurchasedAt.
- **Consumption Profile**: Stores a user's baseline items used to smart-populate shopping lists. `lastPurchasedAt` is reserved for post-MVP.
- **Auth**: JWT-based. Tracks `passwordChangedAt` on the user to invalidate tokens issued before a password change.

## Environment

Two env files: `.env.development` and `.env.production`.
Required variables: `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`.
