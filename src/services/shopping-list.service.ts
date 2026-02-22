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

import { ConsumptionProfileRepository } from '../repositories/consumption-profile.repository';

export type SoonSuggestion = {
  name: string;
  daysUntilDue: number;
  intervalDays: number;
};

export class ShoppingListService {
  private readonly repo = new ShoppingListRepository();
  private readonly consumptionRepo = new ConsumptionProfileRepository();

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

  async purchaseItemInActiveList(userId: string, itemId: string): Promise<ShoppingList> {
    const active = await this.repo.getOrCreateActiveList(userId);

    const item = await this.repo.getItemById(userId, active.id, itemId);
    if (!item) throw new AppError('Item or list not found', 404);

    const updated = await this.repo.deleteItem(userId, active.id, itemId);
    if (!updated) throw new AppError('Item not found', 404);

    // update baseline best-effort
    const norm = normalizeName(item.name);
    await this.consumptionRepo.markPurchasedByNormalizedName(userId, norm);

    return updated;
  }
  // async togglePurchasedInActiveList(userId: string, itemId: string): Promise<ShoppingList> {
  //   const active = await this.repo.getOrCreateActiveList(userId);

  //   const current = await this.repo.getItemPurchasedState(userId, active.id, itemId);
  //   if (current === null) throw new AppError('Item or list not found', 404);

  //   const updated = await this.repo.setItemPurchased(userId, active.id, itemId, !current);
  //   if (!updated) throw new AppError('Item or list not found', 404);

  //   return updated;
  // }

  // shopping-list.service.ts

  async syncBaselineToActiveList(
    userId: string,
    baselineItems: BaselineItem[],
  ): Promise<ShoppingList> {
    const activeList = await this.repo.getOrCreateActiveList(userId);

    // Names that already exist in the current active list (pending-only)
    const existingNames = new Set(activeList.items.map((i) => normalizeName(i.name)));

    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    let current = activeList;

    for (const b of baselineItems) {
      const key = normalizeName(b.name);

      // Skip if the item already exists to avoid duplicates
      if (existingNames.has(key)) continue;

      // Due = never purchased before OR interval has passed since last purchase
      const last = b.lastPurchasedAt ? new Date(b.lastPurchasedAt).getTime() : null;
      const daysSince = last === null ? Infinity : (now - last) / dayMs;

      const isDue = last === null || daysSince >= b.intervalDays;
      if (!isDue) continue;

      // Add to active list and track to prevent duplicates within this sync run
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

  computeSoonSuggestions(
    activeList: ShoppingList,
    baselineItems: BaselineItem[],
    maxWindowDays = 3,
  ): SoonSuggestion[] {
    // Avoid suggesting items that already exist in the active list
    const existingNames = new Set(activeList.items.map((i) => normalizeName(i.name)));

    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    const res: SoonSuggestion[] = [];

    for (const b of baselineItems) {
      const key = normalizeName(b.name);

      // If it's already in the active list, no need to suggest it
      if (existingNames.has(key)) continue;

      const last = b.lastPurchasedAt ? new Date(b.lastPurchasedAt).getTime() : null;

      // Never purchased => it's Due (sync should add it), not Soon
      if (last === null) continue;

      const daysSince = (now - last) / dayMs;

      // Already due => not a soon suggestion
      if (daysSince >= b.intervalDays) continue;

      // Dynamic window: up to maxWindowDays, capped at half the interval (prevents noise for short intervals)
      const windowDays = Math.min(maxWindowDays, Math.floor(b.intervalDays / 2));
      if (windowDays <= 0) continue;

      const daysUntilDue = Math.ceil(b.intervalDays - daysSince);

      // Soon if due within the window
      if (daysUntilDue <= windowDays) {
        res.push({
          name: b.name,
          daysUntilDue,
          intervalDays: b.intervalDays,
        });
      }
    }

    // Closest-to-due first
    res.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return res;
  }
}
