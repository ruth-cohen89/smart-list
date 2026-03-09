import { ReceiptMatchService } from '../../../src/services/receipt-match.service';
import { AppError } from '../../../src/errors/app-error';
import type { ReceiptRepository } from '../../../src/repositories/receipt.repository';
import type { ShoppingListRepository } from '../../../src/repositories/shopping-list.repository';
import type { ConsumptionProfileRepository } from '../../../src/repositories/consumption-profile.repository';

// ─── Mock repositories ────────────────────────────────────────────────────────

const mockReceiptRepo = {
  findByIdAndUser: jest.fn(),
  createReceipt: jest.fn(),
  updateStatus: jest.fn(),
};

const mockShoppingListRepo = {
  findActiveList: jest.fn(),
  deleteItem: jest.fn(),
};

const mockConsumptionRepo = {
  getOrCreate: jest.fn(),
  markPurchasedByNormalizedName: jest.fn(),
};

const service = new ReceiptMatchService(
  mockReceiptRepo as unknown as ReceiptRepository,
  mockShoppingListRepo as unknown as ShoppingListRepository,
  mockConsumptionRepo as unknown as ConsumptionProfileRepository,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RECEIPT_ID = 'receipt-1';
const USER_ID = 'user-1';

function makeReceipt(items: Array<{ id: string; name: string; normalizedName?: string }>) {
  return {
    id: RECEIPT_ID,
    userId: USER_ID,
    status: 'SCANNED' as const,
    rawText: '',
    uploadedAt: new Date(),
    items,
  };
}

function makeListItem(id: string, name: string) {
  return {
    id,
    name,
    category: 'general',
    quantity: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReceiptRepo.updateStatus.mockResolvedValue(undefined);
  mockShoppingListRepo.deleteItem.mockResolvedValue(undefined);
  mockConsumptionRepo.markPurchasedByNormalizedName.mockResolvedValue(undefined);
});

// ─── matchReceiptItems ────────────────────────────────────────────────────────

describe('matchReceiptItems', () => {
  it('auto-approves an exact name match against the shopping list', async () => {
    mockReceiptRepo.findByIdAndUser.mockResolvedValue(
      makeReceipt([{ id: 'ri-1', name: 'חלב תנובה', normalizedName: 'חלב תנובה' }]),
    );
    mockShoppingListRepo.findActiveList.mockResolvedValue({
      id: 'list-1',
      items: [makeListItem('li-1', 'חלב תנובה')],
    });
    mockConsumptionRepo.getOrCreate.mockResolvedValue({ baselineItems: [] });

    const result = await service.matchReceiptItems(USER_ID, RECEIPT_ID);

    expect(result.matchedReceiptItems).toHaveLength(1);
    expect(result.matchedReceiptItems[0].shoppingListMatch?.status).toBe('autoApproved');
    // Auto-approved → item is removed from the list immediately
    expect(mockShoppingListRepo.deleteItem).toHaveBeenCalledWith(USER_ID, 'list-1', 'li-1');
  });

  it('returns pendingConfirmation when a single-token candidate is a subset of a multi-token receipt item', async () => {
    // "שוקולד" (1 token in list) vs "שוקולד אגוזים" (2 tokens in receipt)
    // Score ≥ 0.9 via substring rule, but shouldForcePending blocks auto-approval.
    mockReceiptRepo.findByIdAndUser.mockResolvedValue(
      makeReceipt([{ id: 'ri-1', name: 'שוקולד אגוזים', normalizedName: 'שוקולד אגוזים' }]),
    );
    mockShoppingListRepo.findActiveList.mockResolvedValue({
      id: 'list-1',
      items: [makeListItem('li-1', 'שוקולד')],
    });
    mockConsumptionRepo.getOrCreate.mockResolvedValue({ baselineItems: [] });

    const result = await service.matchReceiptItems(USER_ID, RECEIPT_ID);

    expect(result.matchedReceiptItems[0].shoppingListMatch?.status).toBe('pendingConfirmation');
    // Should NOT be auto-deleted
    expect(mockShoppingListRepo.deleteItem).not.toHaveBeenCalled();
  });

  it('places a receipt item in unmatchedReceiptItems when no candidate meets the threshold', async () => {
    mockReceiptRepo.findByIdAndUser.mockResolvedValue(
      makeReceipt([{ id: 'ri-1', name: 'בננה', normalizedName: 'בננה' }]),
    );
    mockShoppingListRepo.findActiveList.mockResolvedValue({
      id: 'list-1',
      items: [makeListItem('li-1', 'עגבנייה')], // completely different word
    });
    mockConsumptionRepo.getOrCreate.mockResolvedValue({ baselineItems: [] });

    const result = await service.matchReceiptItems(USER_ID, RECEIPT_ID);

    expect(result.unmatchedReceiptItems).toHaveLength(1);
    expect(result.unmatchedReceiptItems[0].receiptItemId).toBe('ri-1');
    expect(result.matchedReceiptItems).toHaveLength(0);
  });
});

// ─── confirmReceiptMatches ────────────────────────────────────────────────────

describe('confirmReceiptMatches', () => {
  it('deletes the matched shopping list item and marks the receipt as APPLIED', async () => {
    mockReceiptRepo.findByIdAndUser.mockResolvedValue(
      makeReceipt([{ id: 'ri-1', name: 'חלב', normalizedName: 'חלב' }]),
    );
    mockShoppingListRepo.findActiveList.mockResolvedValue({
      id: 'list-1',
      items: [makeListItem('li-1', 'חלב')],
    });
    mockConsumptionRepo.getOrCreate.mockResolvedValue({ baselineItems: [] });

    const result = await service.confirmReceiptMatches(USER_ID, RECEIPT_ID, {
      matches: [{ receiptItemId: 'ri-1', shoppingListItemId: 'li-1' }],
    });

    expect(result.receiptId).toBe(RECEIPT_ID);
    expect(result.confirmedMatches[0].confirmedShoppingListMatch).toBe(true);
    expect(mockShoppingListRepo.deleteItem).toHaveBeenCalledWith(USER_ID, 'list-1', 'li-1');
    expect(mockReceiptRepo.updateStatus).toHaveBeenCalledWith(RECEIPT_ID, USER_ID, 'APPLIED');
  });

  it('throws AppError 404 when the receiptItemId does not exist on the receipt', async () => {
    mockReceiptRepo.findByIdAndUser.mockResolvedValue(
      makeReceipt([{ id: 'ri-1', name: 'חלב', normalizedName: 'חלב' }]),
    );
    mockShoppingListRepo.findActiveList.mockResolvedValue({ id: 'list-1', items: [] });
    mockConsumptionRepo.getOrCreate.mockResolvedValue({ baselineItems: [] });

    await expect(
      service.confirmReceiptMatches(USER_ID, RECEIPT_ID, {
        matches: [{ receiptItemId: 'does-not-exist', shoppingListItemId: 'li-1' }],
      }),
    ).rejects.toThrow(AppError);
  });
});
