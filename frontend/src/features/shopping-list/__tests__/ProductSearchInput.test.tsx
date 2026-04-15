import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductSearchInput from '../ProductSearchInput';

vi.mock('../../../services/productGroupService', () => ({
  productGroupService: {
    searchGroups: vi.fn(),
    getVariants: vi.fn(),
    mapGroup: vi.fn(),
  },
}));

vi.mock('../../../services/productService', () => ({
  productService: {
    search: vi.fn(),
  },
}));

import { productGroupService } from '../../../services/productGroupService';

const defaultProps = {
  onSelect: vi.fn(),
  onClear: vi.fn(),
};

describe('ProductSearchInput autocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the canonical group returned by the API for alias query בגט', async () => {
    vi.mocked(productGroupService.searchGroups).mockResolvedValue({
      results: [{
        id: 'baguette',
        name: 'באגט',
        department: 'מזון',
        category: 'לחם ומאפים',
        selectionMode: 'canonical',
      }],
    });

    render(<ProductSearchInput {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText('Search for a product…'), 'בגט');

    await waitFor(() => {
      expect(screen.getByText('באגט')).toBeInTheDocument();
    });
  });

  it('displays the canonical group returned by the API for alias query קמח ספלט', async () => {
    vi.mocked(productGroupService.searchGroups).mockResolvedValue({
      results: [{
        id: 'spelt-flour',
        name: 'קמח כוסמין',
        department: 'מזון',
        category: 'שמנים, תבלינים ואפייה',
        selectionMode: 'sku',
      }],
    });

    render(<ProductSearchInput {...defaultProps} />);

    await userEvent.type(screen.getByPlaceholderText('Search for a product…'), 'קמח ספלט');

    await waitFor(() => {
      expect(screen.getByText('קמח כוסמין')).toBeInTheDocument();
    });
  });
});
