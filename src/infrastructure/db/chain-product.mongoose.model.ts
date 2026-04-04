import mongoose, { Schema, Document } from 'mongoose';
import type { ChainId } from '../../models/chain-product.model';

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
  createdAt: Date;
  updatedAt: Date;
}

const ChainProductSchema = new Schema<IChainProductDocument>(
  {
    chainId: {
      type: String,
      required: true,
      enum: ['shufersal', 'rami-levy', 'osher-ad'],
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
  },
  { timestamps: true },
);

// Primary upsert key: each chain has at most one record per externalId
ChainProductSchema.index({ chainId: 1, externalId: 1 }, { unique: true });

// Fast barcode lookups (sparse — barcode is optional)
ChainProductSchema.index({ barcode: 1, chainId: 1 }, { sparse: true });

// Candidate name search per chain
ChainProductSchema.index({ normalizedName: 1, chainId: 1 });

export default mongoose.model<IChainProductDocument>('ChainProduct', ChainProductSchema);
