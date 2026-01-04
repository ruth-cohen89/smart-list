import { AppError } from '../errors/app-error';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ConsumptionProfileService } from './consumption-profile.service';

import type { ShoppingList } from '../models/shopping-list.model';
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
    private readonly consumptionProfileService = new ConsumptionProfileService();

    async createFromBaseline(userId: string, input: CreateFromBaselineInput = {}): Promise<ShoppingList> {
        const profile = await this.consumptionProfileService.getOrCreate(userId);
        const baselineItems = profile.baselineItems ?? [];


        const created = await this.repo.createList(userId, {
            name: input.name ?? 'My shopping list',
            description: input.description,
            status: 'active',
            defaultCategoryOrder: [],
        });


        const seen = new Set<string>();
        let current: ShoppingList = created;

        for (const b of baselineItems) {
            const key = (b.normalizedName ?? b.name).trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);

            const itemInput: any = {
                name: b.name,
                category: 'other',
                unit: b.unit,
                priority: 'medium',
            };

            if (b.quantity !== undefined) {
                itemInput.quantity = b.quantity;
            }

            const updated = await this.repo.addItem(userId, created.id, itemInput);
            if (updated) current = updated;
        }













        return current;
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

    async updateList(userId: string, listId: string, input: UpdateShoppingListInput): Promise<ShoppingList> {
        const updated = await this.repo.updateListForUser(userId, listId, input);
        if (!updated) throw new AppError('Shopping list not found', 404);
        return updated;
    }

    async deleteList(userId: string, listId: string): Promise<{ message: string }> {
        const ok = await this.repo.deleteListForUser(userId, listId);
        if (!ok) throw new AppError('Shopping list not found', 404);
        return { message: 'Deleted successfully' };
    }

    async addItem(userId: string, listId: string, input: CreateItemInput): Promise<ShoppingList> {
        const updated = await this.repo.addItem(userId, listId, input);
        if (!updated) throw new AppError('Shopping list not found', 404);
        return updated;
    }

    async updateItem(
        userId: string,
        listId: string,
        itemId: string,
        input: UpdateItemInput
    ): Promise<ShoppingList> {
        const updated = await this.repo.updateItem(userId, listId, itemId, input);
        if (!updated) throw new AppError('Item or list not found', 404);
        return updated;
    }

    async deleteItem(userId: string, listId: string, itemId: string): Promise<ShoppingList> {
        const updated = await this.repo.deleteItem(userId, listId, itemId);

        if (!updated) {
            throw new AppError('Item not found', 404);
        }

        return updated;
    }


    async togglePurchased(userId: string, listId: string, itemId: string): Promise<ShoppingList> {
        const current = await this.repo.getItemPurchasedState(userId, listId, itemId);
        if (current === null) throw new AppError('Item or list not found', 404);

        const next = !current;

        const updated = await this.repo.setItemPurchased(userId, listId, itemId, next);
        if (!updated) throw new AppError('Item or list not found', 404);

        return updated;
    }
}
