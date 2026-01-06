import mongoose, { Schema, Document, Types } from 'mongoose';

export type ListStatus = 'active' | 'completed' | 'archived';
export type ItemPriority = 'low' | 'medium' | 'high';

export interface IShoppingItemDocument extends Document {
    name: string;
    category: string;
    quantity: number;
    unit?: string;
    notes?: string;
    purchased: boolean;
    priority?: ItemPriority;

    // ✅ added
    lastPurchasedAt: Date | null;
    usageScore: number;

    createdAt: Date;
    updatedAt: Date;
}

export interface IShoppingListDocument extends Document {
    userId: Types.ObjectId;

    name: string;
    description?: string;

    status: ListStatus;
    defaultCategoryOrder: string[];

    items: Types.DocumentArray<IShoppingItemDocument>;

    createdAt: Date;
    updatedAt: Date;
}

const ShoppingItemSchema = new Schema<IShoppingItemDocument>(
    {
        name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
        category: { type: String, trim: true, maxlength: 40, default: 'other' },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, trim: true, maxlength: 20 },
        notes: { type: String, trim: true, maxlength: 200 },
        purchased: { type: Boolean, default: false },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },

        lastPurchasedAt: { type: Date, default: null },
        usageScore: { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

const ShoppingListSchema = new Schema<IShoppingListDocument>(
    {
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },

        name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
        description: { type: String, trim: true, maxlength: 200 },

        status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active', index: true },
        defaultCategoryOrder: { type: [String], default: [] },
        items: { type: [ShoppingItemSchema], default: [] },
    },
    { timestamps: true }
);

ShoppingListSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model<IShoppingListDocument>('ShoppingList', ShoppingListSchema);
