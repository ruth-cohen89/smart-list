import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBaselineItemDocument extends Document {
  name: string;
  normalizedName: string;
  quantity?: number;
  unit?: string;

  // Every how many days this item is expected to run out (e.g., weekly=7, monthly=30)
  intervalDays: number;

  // MVP (exist now, not used in POC)
  lastPurchasedAt?: Date;
  usageScore: number;
  lastSuggestedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface IConsumptionProfileDocument extends Document {
  userId: Types.ObjectId;
  baselineItems: Types.DocumentArray<IBaselineItemDocument>;
  createdAt: Date;
  updatedAt: Date;
}

const BaselineItemSchema = new Schema<IBaselineItemDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 1,
      maxlength: 120,
    },

    quantity: { type: Number, min: 1 },
    unit: { type: String, trim: true, maxlength: 20 },

    intervalDays: { type: Number, required: true, min: 1, max: 365 },

    // MVP (safe defaults)
    lastPurchasedAt: { type: Date },
    usageScore: { type: Number, default: 0, min: 0 },
    lastSuggestedAt: { type: Date },
  },
  { timestamps: true },
);

const ConsumptionProfileSchema = new Schema<IConsumptionProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true, unique: true },
    baselineItems: { type: [BaselineItemSchema], default: [] },
  },
  { timestamps: true },
);

ConsumptionProfileSchema.index({ userId: 1, updatedAt: -1 });

// ⚠️ NOTE:
// We intentionally DO NOT create a unique index on baselineItems.normalizedName (multikey unique can be tricky).
// We enforce uniqueness atomically in the repository when adding items.

export default mongoose.model<IConsumptionProfileDocument>(
  'ConsumptionProfile',
  ConsumptionProfileSchema,
);
