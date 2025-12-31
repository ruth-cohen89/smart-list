import { AppError } from '../errors/app-error';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';

import type { ShoppingList } from '../models/shopping-list.model';
import type {
    CreateShoppingListInput,
    UpdateShoppingListInput,
    CreateItemInput,
    UpdateItemInput,
} from '../types/shopping-list';

export class ShoppingListService {
    private readonly repo = new ShoppingListRepository();

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
