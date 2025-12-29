import bcrypt from 'bcrypt'
import crypto from 'crypto';
import { AuthRepository } from '../repositories/auth.repository'
import { generateToken } from '../utils/jwt';
import { handleMissingCredentials, handleInvalidCredentials } from '../errors/auth-handlers';
import { ChangePasswordInput, ForgotPasswordInput, ResetPasswordInput, SignupInput, LoginInput} from "../types/auth";
import { handleMissingSignupFields } from '../errors/auth-handlers';
import { AppError } from '../errors/app-error';
import { ForgotPasswordResponse } from '../types/auth';

const RESET_TOKEN_TTL_MIN = 15;

export class AuthService {
    constructor(private readonly repo: AuthRepository) {
    }

    async changePassword(userId: string, input?: ChangePasswordInput): Promise<{ token: string }> {
        if (!input) throw new AppError('Request body is required', 400);

        const { currentPassword, newPassword, confirmPassword } = input;
        if (!currentPassword || !newPassword || !confirmPassword) {
            throw new AppError('Missing required fields', 400);
        }
        if (newPassword !== confirmPassword) throw new AppError('Passwords do not match', 400);
        if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400);

        const user = await this.repo.findByIdWithPassword(userId);
        if (!user) throw new AppError('User not found', 404);

        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) throw new AppError('Current password is incorrect', 401);

        const hashed = await bcrypt.hash(newPassword, 10);
        await this.repo.updatePassword(userId, hashed, new Date());

        const token = generateToken({ id: user.id, role: user.role });
        return { token };
    }

    async forgotPassword(input?: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
        if (!input) throw new AppError('Request body is required', 400);

        const email = input.email?.trim().toLowerCase();
        if (!email) throw new AppError('Email is required', 400);

        const user = await this.repo.findByEmail(email);

        if (!user) throw new AppError('User no longer exists', 400);

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

        await this.repo.setPasswordResetToken(user.id, tokenHash, expiresAt);

        return { resetToken: rawToken };
    }

    async resetPassword(input?: ResetPasswordInput): Promise<{ token: string }> {
        if (!input) throw new AppError('Request body is required', 400);

        const { token, newPassword, confirmPassword } = input;
        if (!token || !newPassword || !confirmPassword) throw new AppError('Missing required fields', 400);
        if (newPassword !== confirmPassword) throw new AppError('Passwords do not match', 400);
        if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400);


        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await this.repo.findByResetTokenHash(tokenHash);
        if (!user) throw new AppError('Token is invalid or expired', 400);

        const hashed = await bcrypt.hash(newPassword, 10);

        await this.repo.resetPassword(user.id, hashed, new Date());

        const jwt = generateToken({ id: user.id, role: user.role });
        return { token: jwt };
    }

    async signUp({ fullName, email, password }: SignupInput) {
        if (!fullName || !email || !password) {
            throw handleMissingSignupFields();
        }

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


        const {password: _pw, ...safeUser } = createdUser;


        return {
            user: safeUser,
            token,
        };
    }

    async login({ email, password }: LoginInput) {
        if (!email || !password) throw handleMissingCredentials();

        const user = await this.repo.findByEmailWithPassword(email);
        if (!user) throw handleInvalidCredentials();

        if (typeof password !== 'string' || typeof user.password !== 'string') {
            throw handleInvalidCredentials();
        }


        const ok = await bcrypt.compare(password, user.password);
        if (!ok) throw handleInvalidCredentials();

        const token = generateToken({ id: user.id, role: user.role });
        const { password: _pw, ...safeUser } = user;

        return { user: safeUser, token };
    }

}
