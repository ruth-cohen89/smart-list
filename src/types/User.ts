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

export type Role = 'user' | 'admin';

export type CreateUserInput = {
  fullName: string;
  email: string;
  password: string;
  role?: Role;
};

export type CreateUserData = {
  fullName: string;
  email: string;
  password: string;
  role: Role;
};

export type UpdateUserInput = {
  fullName?: string;
  email?: string;
  password?: string;
  role?: Role;
};

export type UpdateUserData = {
  fullName?: string;
  email?: string;
  password?: string;
  role?: Role;
  updatedAt: Date;
};

export type UpdateMeInput = {
  fullName?: string;
  email?: string;
};

export type UpdateMeData = {
  fullName?: string;
  email?: string;
  updatedAt: Date;
};
