import { AppError } from '../errors/app-error';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { normalizeName } from '../utils/normalize';

import type { ShoppingList } from '../models/shopping-list.model';
import type { BaselineItem } from '../models/consumption-profile.model';
import type {
  CreateShoppingListInput,
  UpdateShoppingListInput,
  CreateItemInput,
  UpdateItemInput,
} from '../types/shopping-list';

type CreateFromBaselineInput = {
  name?: string;
  description?: string;
};

export class ShoppingListService {
  private readonly repo = new ShoppingListRepository();

  // ─── Active-list invariant ────────────────────────────────────────────────

  getOrCreateActiveList(userId: string): Promise<ShoppingList> {
    return this.repo.getOrCreateActiveList(userId);
  }

  // Non-destructive sync: adds baseline items that are not already present in
  // the active list (matched by normalized name). Existing items are untouched.
  async syncBaselineToActiveList(
    userId: string,
    baselineItems: BaselineItem[],
  ): Promise<ShoppingList> {
    const activeList = await this.repo.getOrCreateActiveList(userId);

    const existingNames = new Set(activeList.items.map((i) => normalizeName(i.name)));

    let current = activeList;

    for (const b of baselineItems) {
      const key = normalizeName(b.name);
      if (existingNames.has(key)) continue;
      existingNames.add(key);

      const itemInput: CreateItemInput = {
        name: b.name,
        category: 'other',
        quantity: b.quantity ?? 1,
        unit: b.unit,
        priority: 'medium',
      };

      const updated = await this.repo.addItem(userId, current.id, itemInput);
      if (updated) current = updated;
    }

    return current;
  }

  // ─── List CRUD ────────────────────────────────────────────────────────────

  // Syncs the user's active list with the supplied baseline items, optionally
  // renaming the list. Replaces the old "create a brand-new list" flow:
  // with the one-active-list invariant there is always exactly one list to work with.
  async createFromBaseline(
    userId: string,
    baselineItems: BaselineItem[],
    input: CreateFromBaselineInput = {},
  ): Promise<ShoppingList> {
    const activeList = await this.repo.getOrCreateActiveList(userId);

    if (input.name !== undefined || input.description !== undefined) {
      const patch: UpdateShoppingListInput = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      await this.repo.updateListForUser(userId, activeList.id, patch);
    }

    return this.syncBaselineToActiveList(userId, baselineItems);
  }

  createList(userId: string, input: CreateShoppingListInput): Promise<ShoppingList> {
    return this.repo.createList(userId, input);
  }

  getMyLists(userId: string): Promise<ShoppingList[]> {
    return this.repo.findListsByUser(userId);
  }

  async getList(userId: string, listId: string): Promise<ShoppingList> {
    const list = await this.repo.findListByIdForUser(userId, listId);
    if (!list) throw new AppError('Shopping list not found', 404);
    return list;
  }

  async updateList(
    userId: string,
    listId: string,
    input: UpdateShoppingListInput,
  ): Promise<ShoppingList> {
    const updated = await this.repo.updateListForUser(userId, listId, input);
    if (!updated) throw new AppError('Shopping list not found', 404);
    return updated;
  }

  async deleteList(userId: string, listId: string): Promise<{ message: string }> {
    const ok = await this.repo.deleteListForUser(userId, listId);
    if (!ok) throw new AppError('Shopping list not found', 404);
    return { message: 'Deleted successfully' };
  }

  // ─── Item CRUD ────────────────────────────────────────────────────────────

  async addItem(userId: string, listId: string, input: CreateItemInput): Promise<ShoppingList> {
    const updated = await this.repo.addItem(userId, listId, input);
    if (!updated) throw new AppError('Shopping list not found', 404);
    return updated;
  }

  async updateItem(
    userId: string,
    listId: string,
    itemId: string,
    input: UpdateItemInput,
  ): Promise<ShoppingList> {
    const updated = await this.repo.updateItem(userId, listId, itemId, input);
    if (!updated) throw new AppError('Item or list not found', 404);
    return updated;
  }

  async deleteItem(userId: string, listId: string, itemId: string): Promise<ShoppingList> {
    const updated = await this.repo.deleteItem(userId, listId, itemId);
    if (!updated) throw new AppError('Item not found', 404);
    return updated;
  }

  async togglePurchased(userId: string, listId: string, itemId: string): Promise<ShoppingList> {
    const current = await this.repo.getItemPurchasedState(userId, listId, itemId);
    if (current === null) throw new AppError('Item or list not found', 404);

    const updated = await this.repo.setItemPurchased(userId, listId, itemId, !current);
    if (!updated) throw new AppError('Item or list not found', 404);

    return updated;
  }
}
