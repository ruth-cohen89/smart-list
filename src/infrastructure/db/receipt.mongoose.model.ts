import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReceiptItemDocument extends Types.Subdocument {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  quantity?: number;
  price?: number;
  category?: string;
}

export interface IReceiptDocument extends Document {
  userId: Types.ObjectId;
  uploadedAt: Date;
  rawText: string;
  status: 'SCANNED' | 'APPLIED';
  items: Types.DocumentArray<IReceiptItemDocument>;
}

const ReceiptItemSchema = new Schema<IReceiptItemDocument>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true },
    quantity: { type: Number, min: 0 },
    price: { type: Number, min: 0 },
    category: { type: String, trim: true },
  },
  {
    _id: true, // אפשר גם למחוק לגמרי, זה default
    timestamps: false,
  },
);

const ReceiptSchema = new Schema<IReceiptDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    uploadedAt: { type: Date, required: true },
    rawText: { type: String, required: true },
    status: { type: String, enum: ['SCANNED', 'APPLIED'], default: 'SCANNED' },
    items: { type: [ReceiptItemSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<IReceiptDocument>('Receipt', ReceiptSchema);
