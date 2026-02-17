export interface User {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;

  passwordChangedAt?: Date;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
}
