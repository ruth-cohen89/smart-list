import mongoose, { Schema, Document } from 'mongoose';
import { SUPPORTED_CHAINS, type ChainId } from '../../models/chain-product.model';
import { PromotionKind } from '../../models/promotion.model';

export interface IChainProductDocument extends Document {
  chainId: ChainId;
  productId?: mongoose.Types.ObjectId;
  productType?: 'packaged' | 'produce';
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  priceUpdateDate?: Date;
  unit?: string;
  quantity?: number;
  unitType?: string;
  isActive: boolean;
  lastSeenAt: Date;
  promotions: Array<{
    chainId: ChainId;
    promotionId: string;
    description: string;
    startAt: Date | null;
    endAt: Date | null;
    parsedPromotionKind: PromotionKind;
    discountType?: number;
    discountRate?: number;
    discountedPrice?: number;
    minQty?: number;
    maxQty?: number;
    minItemsOffered?: number;
    discountedPricePerMida?: number;
    minPurchaseAmount?: number;
    isWeightedPromo?: boolean;
    allowMultipleDiscounts?: boolean;
    isGift?: boolean;
    isCoupon?: boolean;
    isTotal?: boolean;
    clubId?: string;
    remarks?: string;
  }>;
  hasActivePromotions: boolean;
  lastPromotionSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmbeddedPromotionSchema = new Schema(
  {
    chainId: {
      type: String,
      required: true,
      enum: SUPPORTED_CHAINS,
    },
    promotionId: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    parsedPromotionKind: {
      type: String,
      required: true,
      enum: Object.values(PromotionKind),
      default: PromotionKind.UNKNOWN,
    },
    discountType: { type: Number },
    discountRate: { type: Number, min: 0 },
    discountedPrice: { type: Number, min: 0 },
    minQty: { type: Number, min: 0 },
    maxQty: { type: Number, min: 0 },
    minItemsOffered: { type: Number, min: 0 },
    discountedPricePerMida: { type: Number, min: 0 },
    minPurchaseAmount: { type: Number, min: 0 },
    isWeightedPromo: { type: Boolean },
    allowMultipleDiscounts: { type: Boolean },
    isGift: { type: Boolean },
    isCoupon: { type: Boolean },
    isTotal: { type: Boolean },
    clubId: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

const ChainProductSchema = new Schema<IChainProductDocument>(
  {
    chainId: {
      type: String,
      required: true,
      enum: SUPPORTED_CHAINS,
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: undefined },
    productType: { type: String, enum: ['packaged', 'produce'] },
    externalId: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, sparse: true },
    originalName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    price: { type: Number, required: true, min: 0 },
    priceUpdateDate: { type: Date },
    unit: { type: String, trim: true, maxlength: 30 },
    quantity: { type: Number, min: 0 },
    unitType: { type: String, trim: true, maxlength: 30 },
    isActive: { type: Boolean, required: true, default: true },
    lastSeenAt: { type: Date, required: true },
    promotions: { type: [EmbeddedPromotionSchema], default: [] },
    hasActivePromotions: { type: Boolean, required: true, default: false },
    lastPromotionSyncAt: { type: Date },
  },
  { timestamps: true },
);

ChainProductSchema.index({ chainId: 1, externalId: 1 }, { unique: true });
ChainProductSchema.index({ productId: 1 }, { sparse: true });
ChainProductSchema.index({ chainId: 1, barcode: 1, isActive: 1 }, { sparse: true });
ChainProductSchema.index({ chainId: 1, normalizedName: 1, isActive: 1 });
ChainProductSchema.index({ barcode: 1, isActive: 1 }, { sparse: true });
ChainProductSchema.index({ chainId: 1, hasActivePromotions: 1, isActive: 1 });

export default mongoose.model<IChainProductDocument>('ChainProduct', ChainProductSchema);
