export type ReceiptStatus = 'SCANNED' | 'APPLIED';

export interface ReceiptItemInput {
  name: string;
  normalizedName: string;
  quantity?: number;
  price?: number;
  category?: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  normalizedName?: string;
  quantity?: number;
  price?: number;
  category?: string;
}

export interface Receipt {
  id: string;
  userId: string;
  uploadedAt: Date;
  rawText: string;
  status: ReceiptStatus;
  items: ReceiptItem[];
}
