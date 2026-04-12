export type SelectionMode = 'canonical' | 'sku';

export interface ProductGroup {
  id: string;
  name: string;
  normalizedName: string;
  department: string;
  category: string;
  selectionMode: SelectionMode;
  keywords: string[];
  normalizedKeywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}
