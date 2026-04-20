export type ListStatus = 'active' | 'completed' | 'archived';
export type ItemPriority = 'low' | 'medium' | 'high';
export type MatchStatus = 'pending' | 'matched' | 'ambiguous' | 'unmatched';
export type SelectionSource = 'free_text' | 'auto_match' | 'user_selected' | 'barcode';

export interface MatchedProduct {
  productId?: string;
  externalProductCode?: string;
  name: string;
  brand?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  confidence?: number;
}

export interface ItemMatchUpdate {
  itemId: string;
  normalizedName: string;
  matchStatus: MatchStatus;
  matchedProduct: MatchedProduct | null;
  selectionSource: SelectionSource;
}

export type ItemUnit = 'KG' | 'G' | 'UNIT';

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit?: ItemUnit;
  notes?: string;
  priority?: ItemPriority;
  barcode?: string;
  productId?: string;
  isWeighted?: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Matching fields (populated when match-items is triggered)
  rawName?: string;
  normalizedName?: string;
  matchStatus?: MatchStatus;
  selectionSource?: SelectionSource;
  matchedProduct?: MatchedProduct | null;
}

export interface ShoppingList {
  id: string;
  userId: string;

  name: string;
  description?: string;

  status: ListStatus;
  defaultCategoryOrder: string[];

  items: ShoppingItem[];

  createdAt: Date;
  updatedAt: Date;
}
