/**
 * Integration test for POST /api/v1/receipts/:receiptId/confirm-matches.
 *
 * The authenticate middleware and ReceiptMatchService are mocked so no real
 * database or JWT is needed. All other Express middleware (rate-limiter,
 * validation, error handler) run as normal.
 *
 * jest.mock() calls are hoisted above imports by Jest/ts-jest, so the mocks
 * are in place when receipts.routes.ts is first loaded and creates its service
 * instance via `new ReceiptMatchService(...)`.
 */

// ─── Mocks (hoisted) ──────────────────────────────────────────────────────────

jest.mock('../../src/middlewares/authenticate', () => ({
  authenticate: (
    _req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    (_req as unknown as { user: { id: string; role: string } }).user = {
      id: 'test-user-id',
      role: 'user',
    };
    next();
  },
}));

// Auto-mock: Jest replaces every method of ReceiptMatchService with jest.fn().
// The instance created by receipts.routes.ts is accessible via mock.instances[0].
jest.mock('../../src/services/receipt-match.service');

// ─── Imports (run after mocks are in place) ───────────────────────────────────

import request from 'supertest';
import { createApp } from '../../src/app';
import { ReceiptMatchService } from '../../src/services/receipt-match.service';

// ─── Setup ────────────────────────────────────────────────────────────────────

const app = createApp();

// receipts.routes.ts called `new ReceiptMatchService(...)` at module load time;
// the mock captured that instance in mock.instances[0].
const MockedReceiptMatchService = ReceiptMatchService as jest.MockedClass<
  typeof ReceiptMatchService
>;

// Valid 24-hex-char MongoDB ObjectId (required by validateObjectId middleware).
const VALID_RECEIPT_ID = '507f1f77bcf86cd799439011';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/receipts/:receiptId/confirm-matches', () => {
  let mockInstance: jest.Mocked<InstanceType<typeof ReceiptMatchService>>;

  beforeAll(() => {
    mockInstance = MockedReceiptMatchService.mock.instances[0] as jest.Mocked<
      InstanceType<typeof ReceiptMatchService>
    >;
  });

  afterEach(() => {
    mockInstance.confirmReceiptMatches.mockClear();
  });

  it('returns 400 when the matches array is empty (Zod validation failure)', async () => {
    const res = await request(app)
      .post(`/api/v1/receipts/${VALID_RECEIPT_ID}/confirm-matches`)
      .set('Content-Type', 'application/json')
      .send({ matches: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 200 with the confirmed matches payload on valid input', async () => {
    mockInstance.confirmReceiptMatches.mockResolvedValueOnce({
      receiptId: VALID_RECEIPT_ID,
      confirmedMatches: [
        {
          receiptItemId: 'ri-1',
          receiptItemName: 'חלב',
          confirmedShoppingListMatch: true,
          confirmedBaselineMatch: false,
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/receipts/${VALID_RECEIPT_ID}/confirm-matches`)
      .set('Content-Type', 'application/json')
      .send({
        matches: [{ receiptItemId: 'ri-1', shoppingListItemId: 'li-1' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.receiptId).toBe(VALID_RECEIPT_ID);
    expect(res.body.confirmedMatches).toHaveLength(1);
    expect(res.body.confirmedMatches[0].confirmedShoppingListMatch).toBe(true);
  });

  it('returns 400 when the receiptId param is not a valid ObjectId', async () => {
    const res = await request(app)
      .post('/api/v1/receipts/not-a-valid-id/confirm-matches')
      .set('Content-Type', 'application/json')
      .send({ matches: [{ receiptItemId: 'ri-1', shoppingListItemId: 'li-1' }] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});
