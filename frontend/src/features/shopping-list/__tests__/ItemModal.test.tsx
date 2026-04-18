import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemModal from '../ItemModal';

const mocks = vi.hoisted(() => ({
  canonicalSelection: {
    groupId: 'group-1',
    groupName: 'Challah',
    category: 'Bakery',
    selectionMode: 'canonical' as const,
    mapping: {
      group: {
        id: 'group-1',
        name: 'Challah',
        department: 'Food',
        category: 'Bakery',
        selectionMode: 'canonical' as const,
      },
      results: {
        shufersal: [
          {
            chainProductId: 'chain-product-1',
            productId: 'product-1',
            name: 'Challah sliced',
            normalizedName: 'challah sliced',
            price: 12.9,
            barcode: '7290000000011',
            score: 5,
          },
        ],
      },
    },
  },
}));

vi.mock('../ProductSearchInput', () => ({
  default: ({ onSelect }: { onSelect: (selection: typeof mocks.canonicalSelection) => void }) => (
    <button type="button" onClick={() => onSelect(mocks.canonicalSelection)}>
      Select canonical group
    </button>
  ),
}));

describe('ItemModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves a concrete identifier for canonical group selections with mapped barcodes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<ItemModal isOpen onClose={onClose} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Select canonical group' }));
    await userEvent.click(screen.getByRole('button', { name: /add item/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Challah',
          category: 'Bakery',
          quantity: 1,
          priority: 'medium',
          productGroupId: 'group-1',
          productId: 'product-1',
          barcode: '7290000000011',
        }),
      );
    });
  });
});
