import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email('Invalid email');
// .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
//     message: 'Invalid email',
// });

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

const requiredTrimmedString = (msg: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : ''),
    z.string().refine((v) => v.length > 0, { message: msg }),
  );

export const signupSchema = z
  .object({
    fullName: requiredTrimmedString('Full name is required'),
    email: requiredTrimmedString('Email is required').pipe(z.string().email('Invalid email')),
    password: requiredTrimmedString('Password is required').pipe(
      z.string().min(8, 'Password must be at least 8 characters'),
    ),
  })
  .strict();

export const loginSchema = z
  .object({
    email: requiredTrimmedString('Email is required').pipe(z.string().email('Invalid email')),
    password: requiredTrimmedString('Password is required'),
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
