import { z } from 'zod';

const listStatusSchema = z.enum(['active', 'completed', 'archived']);
const prioritySchema = z.enum(['low', 'medium', 'high']);

const nameSchema = z.string().trim().min(1).max(60);
const descriptionSchema = z.string().trim().max(200);

const itemNameSchema = z.string().trim().min(1).max(80);

const categorySchema = z.string().trim().max(40);

const quantitySchema = z.coerce.number().int().min(1);

const unitSchema = z.string().trim().max(20);
const notesSchema = z.string().trim().max(200);

// -------------------- Lists --------------------

export const createShoppingListSchema = z
  .object({
    name: nameSchema,
    description: descriptionSchema.optional(),
    status: listStatusSchema.optional(),
    defaultCategoryOrder: z.array(categorySchema).optional(),
  })
  .strict();

export const updateShoppingListSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    status: listStatusSchema.optional(),
    defaultCategoryOrder: z.array(categorySchema).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.status !== undefined ||
      data.defaultCategoryOrder !== undefined,
    { message: 'No fields to update' },
  );

// -------------------- Items --------------------

export const createItemSchema = z
  .object({
    name: itemNameSchema,
    category: categorySchema.optional(),
    quantity: quantitySchema,
    unit: unitSchema.optional(),
    notes: notesSchema.optional(),
    priority: prioritySchema.optional(),
    // purchased intentionally omitted (use toggle endpoint instead)
  })
  .strict();

export const updateItemSchema = z
  .object({
    name: itemNameSchema.optional(),
    category: categorySchema.optional(),
    quantity: quantitySchema.optional(),
    unit: unitSchema.optional(),
    notes: notesSchema.optional(),
    priority: prioritySchema.optional(),
    // purchased intentionally omitted (use toggle endpoint instead)
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.category !== undefined ||
      data.quantity !== undefined ||
      data.unit !== undefined ||
      data.notes !== undefined ||
      data.priority !== undefined,
    { message: 'No fields to update' },
  );

export const updateItemPurchasedSchema = z
  .object({
    purchased: z.coerce.boolean(),
  })
  .strict();

export type CreateShoppingListDTO = z.infer<typeof createShoppingListSchema>;
export type UpdateShoppingListDTO = z.infer<typeof updateShoppingListSchema>;
export type CreateItemDTO = z.infer<typeof createItemSchema>;
export type UpdateItemDTO = z.infer<typeof updateItemSchema>;
export type UpdateItemPurchasedDTO = z.infer<typeof updateItemPurchasedSchema>;
