import { z } from 'zod';

const roleSchema = z.enum(['user', 'admin']);

const fullNameSchema = z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters');

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email');

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters');

export const createUserSchema = z
    .object({
        fullName: fullNameSchema,
        email: emailSchema,
        password: passwordSchema,
        role: roleSchema.optional(),
    })
    .strict();

export const updateUserSchema = z
    .object({
        fullName: fullNameSchema.optional(),
        email: emailSchema.optional(),
        password: passwordSchema.optional(),
        role: roleSchema.optional(),
    })
    .strict()
    .refine(
        (data) =>
            data.fullName !== undefined ||
            data.email !== undefined ||
            data.password !== undefined ||
            data.role !== undefined,
        { message: 'No fields to update' }
    );

export const updateMeSchema = z
    .object({
        fullName: fullNameSchema.optional(),
        email: emailSchema.optional(),
    })
    .strict()
    .refine(
        (data) => data.fullName !== undefined || data.email !== undefined,
        { message: 'No fields to update' }
    );

// ✅ Types inferred from schemas (controller should use these)
export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type UpdateMeDTO = z.infer<typeof updateMeSchema>;
