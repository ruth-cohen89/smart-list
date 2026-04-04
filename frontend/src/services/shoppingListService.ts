import api from './api';
import type {
  GetActiveListResponse,
  ShoppingList,
  CreateItemPayload,
  UpdateItemPayload,
  UpdateShoppingListPayload,
} from '../types';

export const shoppingListService = {
  getActiveList: () => api.get<GetActiveListResponse>('/shopping-lists/active').then((r) => r.data),

  updateActiveList: (payload: UpdateShoppingListPayload) =>
    api.patch<ShoppingList>('/shopping-lists/active', payload).then((r) => r.data),

  addItem: (payload: CreateItemPayload) =>
    api.post<ShoppingList>('/shopping-lists/active/items', payload).then((r) => r.data),

  updateItem: (itemId: string, payload: UpdateItemPayload) =>
    api.patch<ShoppingList>(`/shopping-lists/active/items/${itemId}`, payload).then((r) => r.data),

  deleteItem: (itemId: string) =>
    api.delete<ShoppingList>(`/shopping-lists/active/items/${itemId}`).then((r) => r.data),

  purchaseItem: (itemId: string) =>
    api.post<ShoppingList>(`/shopping-lists/active/items/${itemId}/purchase`).then((r) => r.data),
};
