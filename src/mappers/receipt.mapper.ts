import type { Receipt, ReceiptItem } from '../models/receipt.model';
import type {
  IReceiptDocument,
  IReceiptItemDocument,
} from '../infrastructure/db/receipt.mongoose.model';

const mapReceiptItem = (item: IReceiptItemDocument): ReceiptItem => ({
  name: item.name,
  normalizedName: item.normalizedName,
  quantity: item.quantity,
  price: item.price,
  category: item.category,
});

export const mapReceipt = (doc: IReceiptDocument): Receipt => ({
  id: String(doc._id),
  userId: String(doc.userId),
  uploadedAt: doc.uploadedAt,
  rawText: doc.rawText,
  status: doc.status,
  items: (doc.items ?? []).map(mapReceiptItem),
});
