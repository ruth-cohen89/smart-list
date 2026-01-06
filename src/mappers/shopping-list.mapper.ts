import type { ShoppingList, ShoppingItem } from '../models/shopping-list.model';
import type { IShoppingListDocument, IShoppingItemDocument } from '../infrastructure/db/shopping-list.mongoose.model';


const mapItem = (item: IShoppingItemDocument): ShoppingItem => ({
    id: String(item._id),
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.notes,
    purchased: item.purchased,
    priority: item.priority,

    usageScore: item.usageScore ?? 0,
    lastPurchasedAt: item.lastPurchasedAt ?? null,

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
});


export const mapShoppingList = (doc: IShoppingListDocument): ShoppingList => ({
    id: String(doc._id),
    userId: String(doc.userId),

    name: doc.name,
    description: doc.description,

    status: doc.status,
    defaultCategoryOrder: doc.defaultCategoryOrder ?? [],

    items: (doc.items ?? []).map(mapItem),

    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
});
