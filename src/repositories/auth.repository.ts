import { User } from '../models/user.model'
import UserModel from '../infrastructure/db/user.mongoose.model'
import { SignupData } from '../types/auth'


export interface AuthRepository {
    signUp(user: SignupData): Promise<User>
    findByEmail(email: string): Promise<User | null>;
    findByEmailWithPassword(email: string): Promise<User | null>;
    findByIdWithPassword(id: string): Promise<User | null>;

    updatePassword(userId: string, hashedPassword: string, changedAt: Date): Promise<void>;

    setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
    findByResetTokenHash(tokenHash: string): Promise<User | null>;
    resetPassword(userId: string, hashedPassword: string, changedAt: Date): Promise<void>;
}

export class AuthMongoRepository implements AuthRepository {

    private mapUser(u: any): User {
        return {
            id: u._id.toString(),
            fullName: u.fullName,
            email: u.email,
            password: u.password,
            role: u.role,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            passwordChangedAt: u.passwordChangedAt,
            passwordResetTokenHash: u.passwordResetTokenHash,
            passwordResetExpiresAt: u.passwordResetExpiresAt,
        }
    }

    async findByEmailWithPassword(email: string): Promise<User | null> {
        const u = await UserModel.findOne({ email }).select('+password').lean();
        return u ? this.mapUser(u) : null;
    }


    async findByEmail(email: string): Promise<User | null> {
        const user = await UserModel.findOne({ email }).lean();
        return user ? this.mapUser(user) : null;
    }
    async findByIdWithPassword(id: string): Promise<User | null> {
        const u = await UserModel.findById(id).select('+password').lean();
        return u ? this.mapUser(u) : null;
    }

    async updatePassword(userId: string, hashedPassword: string, changedAt: Date): Promise<void> {
        await UserModel.findByIdAndUpdate(userId, {
            password: hashedPassword,
            passwordChangedAt: changedAt,
            updatedAt: new Date(),
        });
    }
    async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        await UserModel.findByIdAndUpdate(userId, {
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: expiresAt,
            updatedAt: new Date(),
        });
    }

    async findByResetTokenHash(tokenHash: string): Promise<User | null> {
        const now = new Date();
        const u = await UserModel.findOne({
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: { $gt: now },
        }).lean();

        return u ? this.mapUser(u) : null;
    }

    async resetPassword(userId: string, hashedPassword: string, changedAt: Date): Promise<void> {
        console.log('hashedPassword', hashedPassword)
        await UserModel.findByIdAndUpdate(userId, {
            password: hashedPassword,
            passwordChangedAt: changedAt,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            updatedAt: new Date(),
        });
    }

    async signUp(user: SignupData): Promise<User> {
        try {
            const created = await UserModel.create({ ...user })
            return this.mapUser(created)
        } catch(err:any) {
            throw err;
        }

    }

}
