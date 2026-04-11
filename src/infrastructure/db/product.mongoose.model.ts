import mongoose, { Schema, Document } from 'mongoose';

export interface IProductDocument extends Document {
  productType: 'packaged' | 'produce';
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
  imageStatus?: 'missing' | 'external' | 'cached';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProductDocument>(
  {
    productType: {
      type: String,
      required: true,
      enum: ['packaged', 'produce'],
    },
    barcode: { type: String, trim: true, default: null },
    canonicalKey: { type: String, trim: true, default: null },
    canonicalName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },
    unitType: { type: String, enum: ['ק"ג', 'יחידה'] },
    isWeighted: { type: Boolean },
    imageUrl: { type: String, trim: true },
    imageSource: { type: String, trim: true },
    imageStatus: { type: String, enum: ['missing', 'external', 'cached'] },
  },
  { timestamps: true },
);

// Unique on barcode where not null
ProductSchema.index(
  { barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: 'string', $gt: '' } },
    name: 'unique_barcode',
  },
);

// Unique on canonicalKey where not null
ProductSchema.index(
  { canonicalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { canonicalKey: { $type: 'string', $gt: '' } },
    name: 'unique_canonical_key',
  },
);

ProductSchema.index({ normalizedName: 1 });

export default mongoose.model<IProductDocument>('Product', ProductSchema);
