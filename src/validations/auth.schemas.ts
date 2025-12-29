import { z } from 'zod';

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email');
    // .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    //     message: 'Invalid email',
    // });

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters');

export const signupSchema = z
    .object({
        fullName: z.string().trim().min(2, 'Full name is required'),
        email: emailSchema,
        password: passwordSchema,
    })
    .strict();

export const loginSchema = z
    .object({
        email: emailSchema,
        password: z.string().min(1, 'Password is required'),
    })
    .strict();

export const forgotPasswordSchema = z
    .object({
        email: emailSchema,
    })
    .strict();

export const resetPasswordSchema = z
    .object({
        token: z.string().trim().min(1, 'Token is required'),
        newPassword: passwordSchema,
        confirmPassword: passwordSchema,
    })
    .strict();

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: passwordSchema,
        confirmPassword: passwordSchema,
    })
    .strict();

// TYPES (extracted from the schemas)
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
