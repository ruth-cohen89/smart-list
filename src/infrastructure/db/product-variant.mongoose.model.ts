import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProductVariantDocument extends Document {
  groupId: Types.ObjectId;
  name: string;
  keywords: string[];
  normalizedKeywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariantDocument>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'ProductGroup', required: true, index: true },
    name: { type: String, required: true, trim: true },
    keywords: { type: [String], default: [] },
    normalizedKeywords: { type: [String], default: [] },
    includeKeywords: { type: [String], default: [] },
    excludeKeywords: { type: [String], default: [] },
  },
  { timestamps: true },
);

ProductVariantSchema.index({ groupId: 1, name: 1 }, { unique: true });

export default mongoose.model<IProductVariantDocument>('ProductVariant', ProductVariantSchema);
