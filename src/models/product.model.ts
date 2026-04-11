export type ProductType = 'packaged' | 'produce';
export type ImageStatus = 'missing' | 'external' | 'cached';

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
  imageUrl?: string;
  imageSource?: string;
  imageStatus?: ImageStatus;
  createdAt: Date;
  updatedAt: Date;
}
