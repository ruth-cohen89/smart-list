import mongoose, { Schema, Document } from 'mongoose';

export interface IProductGroupDocument extends Document {
  name: string;
  normalizedName: string;
  category: string;
  keywords: string[];
  normalizedKeywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductGroupSchema = new Schema<IProductGroupDocument>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true },
    keywords: { type: [String], default: [] },
    normalizedKeywords: { type: [String], default: [] },
    includeKeywords: { type: [String], default: [] },
    excludeKeywords: { type: [String], default: [] },
  },
  { timestamps: true },
);

ProductGroupSchema.index({ normalizedName: 'text', normalizedKeywords: 'text' });
ProductGroupSchema.index({ normalizedName: 1 });
ProductGroupSchema.index({ category: 1 });

export default mongoose.model<IProductGroupDocument>('ProductGroup', ProductGroupSchema);
