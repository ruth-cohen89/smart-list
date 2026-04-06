import mongoose, { Schema, Document } from 'mongoose';
import type { ChainId } from '../../models/chain-product.model';

export interface IPromotionDocument extends Document {
  chainId: ChainId;
  storeId: string;
  promotionId: string;
  description: string;
  startAt: Date | null;
  endAt: Date | null;
  rewardType?: number;
  discountType?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  discountedPricePerMida?: number;
  discountRate?: number;
  allowMultipleDiscounts?: boolean;
  clubId?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
  itemCodes: string[];
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotionDocument>(
  {
    chainId: {
      type: String,
      required: true,
      enum: ['shufersal', 'rami-levy', 'machsanei-hashuk'],
    },
    storeId: { type: String, required: true, trim: true },
    promotionId: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    rewardType: { type: Number },
    discountType: { type: Number },
    minQty: { type: Number, min: 0 },
    maxQty: { type: Number, min: 0 },
    discountedPrice: { type: Number, min: 0 },
    discountedPricePerMida: { type: Number, min: 0 },
    discountRate: { type: Number, min: 0 },
    allowMultipleDiscounts: { type: Boolean },
    clubId: { type: String, trim: true },
    isGift: { type: Boolean },
    isCoupon: { type: Boolean },
    isTotal: { type: Boolean },
    itemCodes: [{ type: String, trim: true }],
    isActive: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Upsert key — unique promotion identity per chain + store
PromotionSchema.index({ chainId: 1, storeId: 1, promotionId: 1 }, { unique: true });

// Active promo lookup scoped to a chain, filtered by expiry
// Used by future price-comparison: "active promos for chain X ending after now"
PromotionSchema.index({ chainId: 1, isActive: 1, endAt: 1 });

// Per-item promo lookup: "which promos apply to itemCode X on chain Y?"
// itemCodes is an array — Mongoose creates a multikey index automatically
PromotionSchema.index({ itemCodes: 1, chainId: 1, isActive: 1 });

export default mongoose.model<IPromotionDocument>('Promotion', PromotionSchema);
