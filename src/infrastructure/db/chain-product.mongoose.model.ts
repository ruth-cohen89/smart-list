import mongoose, { Schema, Document } from 'mongoose';
import type { ChainId } from '../../models/chain-product.model';
import { PromotionKind } from '../../models/promotion.model';

export interface IChainProductDocument extends Document {
  chainId: ChainId;
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  unit?: string;
  quantity?: number;
  isActive: boolean;
  lastSeenAt: Date;
  promotions: Array<{
    chainId: ChainId;
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
  }>;
  hasActivePromotions: boolean;
  lastPromotionSyncAt?: Date;
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

const EmbeddedPromotionSchema = new Schema(
  {
    chainId: {
      type: String,
      required: true,
      enum: ['shufersal', 'rami-levy', 'machsanei-hashuk'],
    },
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
  },
  { _id: false },
);

const ChainProductSchema = new Schema<IChainProductDocument>(
  {
    chainId: {
      type: String,
      required: true,
      enum: ['shufersal', 'rami-levy', 'machsanei-hashuk'],
    },
    externalId: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, sparse: true },
    originalName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, maxlength: 30 },
    quantity: { type: Number, min: 0 },
    isActive: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true },
    promotions: { type: [EmbeddedPromotionSchema], default: [] },
    hasActivePromotions: { type: Boolean, required: true, default: false },
    lastPromotionSyncAt: { type: Date },
  },
  { timestamps: true },
);

ChainProductSchema.index({ chainId: 1, externalId: 1 }, { unique: true });
ChainProductSchema.index({ chainId: 1, barcode: 1, isActive: 1 }, { sparse: true });
ChainProductSchema.index({ chainId: 1, normalizedName: 1, isActive: 1 });
ChainProductSchema.index({ barcode: 1, isActive: 1 }, { sparse: true });
ChainProductSchema.index({ chainId: 1, hasActivePromotions: 1, isActive: 1 });

export default mongoose.model<IChainProductDocument>('ChainProduct', ChainProductSchema);
