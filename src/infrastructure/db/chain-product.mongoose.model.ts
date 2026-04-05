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

// Upsert key for catalog import: unique product per chain.
// chainId first — all import writes are scoped to one chain.
ChainProductSchema.index({ chainId: 1, externalId: 1 }, { unique: true });

// Within-chain barcode match (primary match path).
// chainId first because every query is already scoped to a chain.
// isActive last — low cardinality, but narrows the result set cheaply after the equality hits.
// sparse: barcode is optional, omit null entries from the index.
ChainProductSchema.index({ chainId: 1, barcode: 1, isActive: 1 }, { sparse: true });

// Within-chain name search (fallback match path, regex on normalizedName).
// chainId first to restrict the scan to one chain before the regex runs.
ChainProductSchema.index({ chainId: 1, normalizedName: 1, isActive: 1 });

// Cross-chain barcode lookup for price comparison (no chainId filter).
// barcode first — this is the lookup key across all chains.
// sparse: omit documents where barcode is absent.
ChainProductSchema.index({ barcode: 1, isActive: 1 }, { sparse: true });

export default mongoose.model<IChainProductDocument>('ChainProduct', ChainProductSchema);
