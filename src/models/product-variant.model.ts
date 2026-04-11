export interface ProductVariant {
  id: string;
  groupId: string;
  name: string;
  keywords: string[];
  normalizedKeywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}
