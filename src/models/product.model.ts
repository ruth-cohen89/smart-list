export type ProductType = 'packaged' | 'produce';

export interface Product {
  id: string;
  productType: ProductType;
  barcode?: string | null;
  canonicalKey?: string | null;
  canonicalName: string;
  normalizedName: string;
  brand?: string;
  category?: string;
  unitType?: 'ק"ג' | 'יחידה';
  isWeighted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
