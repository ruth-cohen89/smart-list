export interface ProductGroup {
  id: string;
  name: string;
  normalizedName: string;
  category: string;
  keywords: string[];
  normalizedKeywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}
