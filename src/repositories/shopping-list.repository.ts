import { Types } from 'mongoose';
import ShoppingListMongoose from '../infrastructure/db/shopping-list.mongoose.model';
import { mapShoppingList } from '../mappers/shopping-list.mapper';

import type { ShoppingList } from '../models/shopping-list.model';
import type {
  CreateShoppingListInput,
  UpdateShoppingListInput,
  CreateItemInput,
  UpdateItemInput,
} from '../types/shopping-list';

export class ShoppingListRepository {
  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  async createList(userId: string, input: CreateShoppingListInput): Promise<ShoppingList> {
    const uid = this.toObjectId(userId);

    const created = await ShoppingListMongoose.create({
      userId: uid,
      name: input.name,
      description: input.description,
      status: input.status ?? 'active',
      defaultCategoryOrder: input.defaultCategoryOrder ?? [],
      items: [],
    });

    return mapShoppingList(created);
  }

  async findActiveList(userId: string): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);
    const doc = await ShoppingListMongoose.findOne({ userId: uid, status: 'active' });
    return doc ? mapShoppingList(doc) : null;
  }

  // Atomically find the active list or create one.
  // The partial unique index on { userId, status:'active' } guarantees at most one
  // active list even under concurrent requests.
  async getOrCreateActiveList(userId: string): Promise<ShoppingList> {
    const uid = this.toObjectId(userId);

    const doc = await ShoppingListMongoose.findOneAndUpdate(
      { userId: uid, status: 'active' },
      {
        $setOnInsert: {
          userId: uid,
          name: 'My Shopping List',
          status: 'active',
          defaultCategoryOrder: [],
          items: [],
        },
      },
      { upsert: true, new: true },
    );

    // findOneAndUpdate with upsert + new:true always returns a document
    if (!doc) throw new Error('getOrCreateActiveList: unexpected null document');

    return mapShoppingList(doc);
  }

  async findListsByUser(userId: string): Promise<ShoppingList[]> {
    const uid = this.toObjectId(userId);

    const docs = await ShoppingListMongoose.find({ userId: uid }).sort({ updatedAt: -1 });
    return docs.map(mapShoppingList);
  }

  async findListByIdForUser(userId: string, listId: string): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);

    const doc = await ShoppingListMongoose.findOne({ _id: listId, userId: uid });
    return doc ? mapShoppingList(doc) : null;
  }

  async updateListForUser(
    userId: string,
    listId: string,
    input: UpdateShoppingListInput,
  ): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);

    const updated = await ShoppingListMongoose.findOneAndUpdate(
      { _id: listId, userId: uid },
      { $set: input },
      { new: true },
    );

    return updated ? mapShoppingList(updated) : null;
  }

  async deleteListForUser(userId: string, listId: string): Promise<boolean> {
    const uid = this.toObjectId(userId);

    const deleted = await ShoppingListMongoose.findOneAndDelete({ _id: listId, userId: uid });
    return !!deleted;
  }

  async addItem(
    userId: string,
    listId: string,
    input: CreateItemInput,
  ): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);

    const updated = await ShoppingListMongoose.findOneAndUpdate(
      { _id: listId, userId: uid },
      {
        $push: {
          items: {
            name: input.name,
            category: input.category ?? 'other',
            quantity: input.quantity,
            unit: input.unit,
            notes: input.notes,
            priority: input.priority ?? 'medium',
            purchased: false,

            usageScore: 0,
            lastPurchasedAt: null,
          },
        },
      },
      { new: true },
    );

    return updated ? mapShoppingList(updated) : null;
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    input: UpdateItemInput,
  ): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);

    // Only set provided fields
    const setObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      // Skip undefined to avoid writing undefined into DB
      if (v === undefined) continue;
      setObj[`items.$.${k}`] = v;
    }

    // If nothing to update, return current list (or null if not found)
    if (Object.keys(setObj).length === 0) {
      const existing = await ShoppingListMongoose.findOne({
        _id: listId,
        userId: uid,
        'items._id': itemId,
      });
      return existing ? mapShoppingList(existing) : null;
    }

    const updated = await ShoppingListMongoose.findOneAndUpdate(
      { _id: listId, userId: uid, 'items._id': itemId },
      { $set: setObj },
      { new: true },
    );

    return updated ? mapShoppingList(updated) : null;
  }

  async deleteItem(userId: string, listId: string, itemId: string): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);

    const updated = await ShoppingListMongoose.findOneAndUpdate(
      { _id: listId, userId: uid, 'items._id': itemId },
      { $pull: { items: { _id: itemId } } },
      { new: true },
    );

    return updated ? mapShoppingList(updated) : null;
  }

  async getItemPurchasedState(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<boolean | null> {
    const uid = this.toObjectId(userId);

    const doc = await ShoppingListMongoose.findOne(
      { _id: listId, userId: uid, 'items._id': itemId },
      { 'items.$': 1 },
    );

    if (!doc || !doc.items?.[0]) return null;
    return doc.items[0].purchased;
  }

  async setItemPurchased(
    userId: string,
    listId: string,
    itemId: string,
    purchased: boolean,
  ): Promise<ShoppingList | null> {
    const uid = this.toObjectId(userId);

    const update = purchased
      ? {
          $set: {
            'items.$.purchased': true,
            'items.$.lastPurchasedAt': new Date(),
          },
          $inc: { 'items.$.usageScore': 1 },
        }
      : {
          $set: { 'items.$.purchased': false },
        };

    const updated = await ShoppingListMongoose.findOneAndUpdate(
      { _id: listId, userId: uid, 'items._id': itemId },
      update,
      { new: true },
    );

    return updated ? mapShoppingList(updated) : null;
  }
}
