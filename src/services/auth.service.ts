import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { generateToken } from '../utils/jwt';
import { handleInvalidCredentials } from '../errors/auth-handlers';
import { AppError } from '../errors/app-error';

import {
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignupInput,
  LoginInput,
} from '../validations/auth.schemas';

import { ForgotPasswordResponse } from '../types/auth'; // מה שנשאר שם

const RESET_TOKEN_TTL_MIN = 15;

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ token: string }> {
    const { currentPassword, newPassword, confirmPassword } = input;

    if (newPassword !== confirmPassword) throw new AppError('Passwords do not match', 400);

    const user = await this.repo.findByIdWithPassword(userId);
    if (!user) throw new AppError('User not found', 404);

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new AppError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.repo.updatePassword(userId, hashed, new Date());

    return { token: generateToken({ id: user.id, role: user.role }) };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
    const { email } = input;

    const user = await this.repo.findByEmail(email);

    // Don't expose if user with that email exists
    if (!user) {
      return { resetToken: 'dummy' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

    await this.repo.setPasswordResetToken(user.id, tokenHash, expiresAt);

    return { resetToken: rawToken };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ token: string }> {
    const { token, newPassword, confirmPassword } = input;

    if (newPassword !== confirmPassword) throw new AppError('Passwords do not match', 400);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.repo.findByResetTokenHash(tokenHash);
    if (!user) throw new AppError('Token is invalid or expired', 400);

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.repo.resetPassword(user.id, hashed, new Date());

    return { token: generateToken({ id: user.id, role: user.role }) };
  }

  async signUp({ fullName, email, password }: SignupInput) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await this.repo.signUp({
      fullName,
      email,
      password: hashedPassword,
      role: 'user',
    });

    const token = generateToken({
      id: createdUser.id,
      role: createdUser.role,
    });

    const { password: _pw, ...safeUser } = createdUser;

    return {
      user: safeUser,
      token,
    };
  }

  async login({ email, password }: LoginInput) {
    const user = await this.repo.findByEmailWithPassword(email);
    if (!user) throw handleInvalidCredentials();

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw handleInvalidCredentials();

    const token = generateToken({ id: user.id, role: user.role });
    const { password: _pw, ...safeUser } = user;

    return { user: safeUser, token };
  }
}
