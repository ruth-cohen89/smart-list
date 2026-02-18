// shopping-list.service.ts
import { AppError } from '../errors/app-error';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';

import type { ShoppingList } from '../models/shopping-list.model';
import type { BaselineItem } from '../models/consumption-profile.model';
import type {
  UpdateShoppingListInput,
  CreateItemInput,
  UpdateItemInput,
} from '../types/shopping-list';
import { normalizeName } from '../utils/normalize';

export class ShoppingListService {
  private readonly repo = new ShoppingListRepository();

  // ─── Active-list invariant ────────────────────────────────────────────────

  getOrCreateActiveList(userId: string): Promise<ShoppingList> {
    return this.repo.getOrCreateActiveList(userId);
  }

  async updateActiveList(userId: string, input: UpdateShoppingListInput): Promise<ShoppingList> {
    const active = await this.repo.getOrCreateActiveList(userId);

    const updated = await this.repo.updateListForUser(userId, active.id, input);
    if (!updated) throw new AppError('Shopping list not found', 404);

    return updated;
  }

  async addItemToActiveList(userId: string, input: CreateItemInput): Promise<ShoppingList> {
    const active = await this.repo.getOrCreateActiveList(userId);

    const updated = await this.repo.addItem(userId, active.id, input);
    if (!updated) throw new AppError('Shopping list not found', 404);

    return updated;
  }

  async updateItemInActiveList(
    userId: string,
    itemId: string,
    input: UpdateItemInput,
  ): Promise<ShoppingList> {
    const active = await this.repo.getOrCreateActiveList(userId);

    const updated = await this.repo.updateItem(userId, active.id, itemId, input);
    if (!updated) throw new AppError('Item or list not found', 404);

    return updated;
  }

  async deleteItemFromActiveList(userId: string, itemId: string): Promise<ShoppingList> {
    const active = await this.repo.getOrCreateActiveList(userId);

    const updated = await this.repo.deleteItem(userId, active.id, itemId);
    if (!updated) throw new AppError('Item not found', 404);

    return updated;
  }

  async togglePurchasedInActiveList(userId: string, itemId: string): Promise<ShoppingList> {
    const active = await this.repo.getOrCreateActiveList(userId);

    const current = await this.repo.getItemPurchasedState(userId, active.id, itemId);
    if (current === null) throw new AppError('Item or list not found', 404);

    const updated = await this.repo.setItemPurchased(userId, active.id, itemId, !current);
    if (!updated) throw new AppError('Item or list not found', 404);

    return updated;
  }

  // ─── Existing helper (kept) ───────────────────────────────────────────────

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
}
