import mongoose, { Schema, Document } from 'mongoose';

export interface IProductGroupDocument extends Document {
  name: string;
  normalizedName: string;
  department: string;
  category: string;
  selectionMode: 'canonical' | 'sku';
  keywords: string[];
  normalizedKeywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  priority: number;
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductGroupSchema = new Schema<IProductGroupDocument>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    department: { type: String, default: '', trim: true },
    category: { type: String, required: true, trim: true },
    selectionMode: { type: String, enum: ['canonical', 'sku'], default: 'canonical' },
    keywords: { type: [String], default: [] },
    normalizedKeywords: { type: [String], default: [] },
    includeKeywords: { type: [String], default: [] },
    excludeKeywords: { type: [String], default: [] },
    priority: { type: Number, default: 0 },
    aliases: { type: [String], default: [] },
  },
  { timestamps: true },
);

ProductGroupSchema.index({ normalizedName: 'text', normalizedKeywords: 'text' });
ProductGroupSchema.index({ normalizedName: 1 });
ProductGroupSchema.index({ category: 1 });

export default mongoose.model<IProductGroupDocument>('ProductGroup', ProductGroupSchema);
