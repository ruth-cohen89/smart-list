import mongoose, { Schema, Document } from 'mongoose';
import type { ChainId } from '../../models/chain-product.model';
import { PromotionKind } from '../../models/promotion.model';

export interface IPromotionDocument extends Document {
  chainId: ChainId;
  storeId: string;
  promotionId: string;
  description: string;
  startAt: Date | null;
  endAt: Date | null;
  rewardType?: number;
  discountType?: number;
  discountRate?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  minItemsOffered?: number;
  items: Array<{ itemCode: string; itemType?: number; isGiftItem?: boolean }>;
  parsedPromotionKind: PromotionKind;
  rawPayload: Record<string, unknown>;
  promotionUpdateAt?: Date;
  discountedPricePerMida?: number;
  allowMultipleDiscounts?: boolean;
  minPurchaseAmount?: number;
  isWeightedPromo?: boolean;
  clubId?: string;
  remarks?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
  itemCodes: string[];
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionItemSchema = new Schema(
  {
    itemCode: { type: String, required: true, trim: true },
    itemType: { type: Number },
    isGiftItem: { type: Boolean },
  },
  { _id: false },
);

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
    discountRate: { type: Number, min: 0 },
    minQty: { type: Number, min: 0 },
    maxQty: { type: Number, min: 0 },
    discountedPrice: { type: Number, min: 0 },
    minItemsOffered: { type: Number, min: 0 },
    items: { type: [PromotionItemSchema], default: [] },
    parsedPromotionKind: {
      type: String,
      required: true,
      enum: Object.values(PromotionKind),
      default: PromotionKind.UNKNOWN,
    },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    promotionUpdateAt: { type: Date },
    discountedPricePerMida: { type: Number, min: 0 },
    allowMultipleDiscounts: { type: Boolean },
    minPurchaseAmount: { type: Number, min: 0 },
    isWeightedPromo: { type: Boolean },
    clubId: { type: String, trim: true },
    remarks: { type: String, trim: true },
    isGift: { type: Boolean },
    isCoupon: { type: Boolean },
    isTotal: { type: Boolean },
    itemCodes: [{ type: String, trim: true }],
    isActive: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: true },
);

PromotionSchema.index({ chainId: 1, storeId: 1, promotionId: 1 }, { unique: true });
PromotionSchema.index({ chainId: 1, isActive: 1, startAt: 1, endAt: 1 });
PromotionSchema.index({ itemCodes: 1, chainId: 1, isActive: 1 });

export default mongoose.model<IPromotionDocument>('Promotion', PromotionSchema);
