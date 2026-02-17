export type ListStatus = 'active' | 'completed' | 'archived';
export type ItemPriority = 'low' | 'medium' | 'high';

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit?: string;
  notes?: string;
  purchased: boolean;
  priority?: ItemPriority;

  usageScore: number;
  lastPurchasedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingList {
  id: string;
  userId: string;

  name: string;
  description?: string;

  status: ListStatus;
  defaultCategoryOrder: string[];

  items: ShoppingItem[];

  createdAt: Date;
  updatedAt: Date;
}
