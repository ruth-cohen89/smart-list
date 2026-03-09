/**
 * API tests for the receipts endpoints:
 *   GET  /api/v1/receipts/:receiptId
 *   POST /api/v1/receipts/upload
 *
 * authenticate is replaced with a pass-through that injects a fake user.
 * ReceiptService is auto-mocked so no real OCR or database calls are made.
 * ReceiptMatchService is also auto-mocked because receipts.routes.ts
 * instantiates it at module load time alongside ReceiptService.
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

jest.mock('../../src/services/receipt.service');
jest.mock('../../src/services/receipt-match.service');

// ─── Imports (run after mocks are in place) ───────────────────────────────────

import request from 'supertest';
import { createApp } from '../../src/app';
import { ReceiptService } from '../../src/services/receipt.service';

// ─── Setup ────────────────────────────────────────────────────────────────────

const app = createApp();

const MockedReceiptService = ReceiptService as jest.MockedClass<typeof ReceiptService>;

// receipts.routes.ts called `new ReceiptService(...)` at module load time.
// The instance is stored in mock.instances[0].
let mockInstance: jest.Mocked<InstanceType<typeof ReceiptService>>;

beforeAll(() => {
  mockInstance = MockedReceiptService.mock.instances[0] as jest.Mocked<
    InstanceType<typeof ReceiptService>
  >;
});

afterEach(() => {
  mockInstance.getReceiptById.mockClear();
  mockInstance.uploadReceipt.mockClear();
});

// Valid 24-hex-char MongoDB ObjectId (required by validateObjectId middleware).
const VALID_RECEIPT_ID = '507f1f77bcf86cd799439011';

// ─── GET /api/v1/receipts/:receiptId ─────────────────────────────────────────

describe('GET /api/v1/receipts/:receiptId', () => {
  it('returns 200 with the receipt when it exists', async () => {
    mockInstance.getReceiptById.mockResolvedValueOnce({
      receipt: {
        id: VALID_RECEIPT_ID,
        userId: 'test-user-id',
        rawText: '',
        status: 'SCANNED',
        uploadedAt: new Date(),
        items: [{ id: 'item-1', name: 'חלב', normalizedName: 'חלב' }],
      },
    });

    const res = await request(app).get(`/api/v1/receipts/${VALID_RECEIPT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.receipt.id).toBe(VALID_RECEIPT_ID);
    expect(res.body.receipt.items).toHaveLength(1);
  });

  it('returns 400 when the receiptId param is not a valid ObjectId', async () => {
    const res = await request(app).get('/api/v1/receipts/not-an-id');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
});

// ─── POST /api/v1/receipts/upload ────────────────────────────────────────────

describe('POST /api/v1/receipts/upload', () => {
  it('returns 201 with receiptId and parsed items after a successful upload', async () => {
    mockInstance.uploadReceipt.mockResolvedValueOnce({
      receiptId: VALID_RECEIPT_ID,
      items: [
        { id: 'item-1', name: 'חלב תנובה', normalizedName: 'חלב תנובה' },
        { id: 'item-2', name: 'לחם שחור', normalizedName: 'לחם שחור' },
      ],
    });

    const res = await request(app)
      .post('/api/v1/receipts/upload')
      // supertest's .attach() builds a multipart/form-data body.
      // The buffer content does not matter because ReceiptService is mocked.
      .attach('file', Buffer.from('fake-image-bytes'), {
        filename: 'receipt.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.receiptId).toBe(VALID_RECEIPT_ID);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].name).toBe('חלב תנובה');
  });
});
