import type { ChainProduct } from '../models/chain-product.model';
import type { IChainProductDocument } from '../infrastructure/db/chain-product.mongoose.model';

export const mapChainProduct = (doc: IChainProductDocument): ChainProduct => ({
  id: String(doc._id),
  chainId: doc.chainId,
  externalId: doc.externalId,
  barcode: doc.barcode,
  originalName: doc.originalName,
  normalizedName: doc.normalizedName,
  price: doc.price,
  unit: doc.unit,
  quantity: doc.quantity,
  isActive: doc.isActive,
  lastSeenAt: doc.lastSeenAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
