import { z } from 'zod';

const confirmReceiptMatchItemSchema = z
  .object({
    receiptItemId: z.string().min(1),
    shoppingListItemId: z.string().optional(),
    baselineItemId: z.string().optional(),
  })
  .refine((data) => data.shoppingListItemId || data.baselineItemId, {
    message: 'At least one of shoppingListItemId or baselineItemId is required',
    path: ['shoppingListItemId'],
  });

export const confirmReceiptMatchesSchema = z.object({
  matches: z.array(confirmReceiptMatchItemSchema).min(1),
});
