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
  /** 0–100. Higher = shown first in search results. Common staples get high priority. */
  priority: number;
  /** Alternative search terms that should match this group (e.g. "חלב" → "חלב 3%") */
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}
