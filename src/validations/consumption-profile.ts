import { z } from 'zod';

const nameSchema = z.string().trim().min(1).max(80);
const unitSchema = z.string().trim().max(20);
const intervalDaysSchema = z.coerce.number().int().min(1).max(365);
const quantitySchema = z.coerce.number().min(1);

// ✅ CREATE item: make required fields optional, enforce required via superRefine
export const createBaselineItemSchema = z
    .object({
        name: nameSchema.optional(),
        quantity: quantitySchema.optional(),
        unit: unitSchema.optional(),
        intervalDays: intervalDaysSchema.optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
        if (data.name === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['name'],
                message: 'name is required',
            });
        }

        if (data.intervalDays === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['intervalDays'],
                message: 'intervalDays is required',
            });
        }
    });

// ✅ UPDATE item: same as before (but keep your "No fields to update")
export const updateBaselineItemSchema = z
    .object({
        name: nameSchema.optional(),
        quantity: quantitySchema.optional(),
        unit: unitSchema.optional(),
        intervalDays: intervalDaysSchema.optional(),
    })
    .strict()
    .refine(
        (data) =>
            data.name !== undefined ||
            data.quantity !== undefined ||
            data.unit !== undefined ||
            data.intervalDays !== undefined,
        { message: 'No fields to update' }
    );

// ---- Profile upsert stays as you already fixed ----

const normalizeLocal = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

export const upsertConsumptionProfileSchema = z
    .object({
        baselineItems: z.array(createBaselineItemSchema).optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
        if (data.baselineItems === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['baselineItems'],
                message: 'baselineItems is required',
            });
            return;
        }

        if (data.baselineItems.length === 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['baselineItems'],
                message: 'baselineItems must not be empty',
            });
            return;
        }

        const seen = new Set<string>();
        for (const item of data.baselineItems) {
            const key = normalizeLocal(item.name ?? '');
            if (seen.has(key)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['baselineItems'],
                    message: 'Duplicate items in baselineItems',
                });
                return;
            }
            seen.add(key);
        }
    });

export type CreateBaselineItemDTO = z.infer<typeof createBaselineItemSchema>;
export type UpdateBaselineItemDTO = z.infer<typeof updateBaselineItemSchema>;
export type UpsertConsumptionProfileDTO = z.infer<typeof upsertConsumptionProfileSchema>;
