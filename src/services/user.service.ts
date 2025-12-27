import { userRepository } from '../repositories/user.repository';
import { CreateUserInput, Role, UpdateUserInput, UpdateUserData } from '../types/User';
import { User } from '../models/user.model'
import bcrypt from 'bcrypt'
import { AppError } from "../errors/app-error";
import { UpdateMeInput, UpdateMeData } from '../types/User';


export class UserService {
    private repo = userRepository;



async getMe(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.repo.findById(userId);
    if (!user) throw new AppError('User not found', 404);

const { password, ...safe } = user;
return safe;
}

    async updateMe(
        userId: string,
        input?: UpdateMeInput
    ): Promise<Omit<User, 'password'>> {
        if (!userId) throw new AppError('Missing user id', 400);


        if (!input) {
            throw new AppError('Request body is required', 400);
        }


        if (input.fullName === undefined && input.email === undefined) {
            throw new AppError('No fields to update', 400);
        }

        const updates: UpdateMeData = { updatedAt: new Date() };

        if (input.fullName !== undefined) updates.fullName = input.fullName;
        if (input.email !== undefined) updates.email = input.email;

        // בדיקת אימייל כפול
        if (updates.email) {
            const existing = await this.repo.findByEmail(updates.email);
            if (existing && existing.id !== userId) {
                throw new AppError('Email already in use', 409);
            }
        }

        const updated = await this.repo.update(userId, updates);
        if (!updated) throw new AppError('User not found', 404);

        const { password, ...safe } = updated;
        return safe;
    }

async deleteMe(userId: string): Promise<void> {
    const existing = await this.repo.findById(userId);
    if (!existing) throw new AppError('User not found', 404);

await this.repo.delete(userId);
}


getAllUsers(): Promise<User[]> {
        return this.repo.findAll()
    }

    async getUserById(id: string): Promise<User> {
        const user = await this.repo.findById(id);
        if (!user) throw new AppError('User not found', 404);
        return user;
    }

    getUserByEmail(email: string): Promise<User | null> {
        return this.repo.findByEmail(email)
    }

    async createUserByAdmin(input: CreateUserInput): Promise<Omit<User, 'password'>> {
        if (!input.fullName || !input.email || !input.password) {
            throw new Error('Missing required fields');
        }

        const role: Role = input.role ?? 'user';

        const existing = await this.repo.findByEmail(input.email);
        if (existing) {
            throw new AppError('Email already in use', 409);
        }


        const hashedPassword = await bcrypt.hash(input.password, 10);

        const created = await this.repo.create({
            fullName: input.fullName,
            email: input.email,
            password: hashedPassword, // כבר hashed
            role,
        });

        const { password, ...safe } = created;
        return safe;
    }



async updateUserByAdmin(
    userId: string,
    input: UpdateUserInput
): Promise<Omit<User, 'password'>> {
    if (!userId) throw new AppError('Missing user id', 400);

    if (
    input.fullName === undefined &&
    input.email === undefined &&
        input.role === undefined
    ) {
        throw new AppError('No fields to update', 400);
    }

    const updates: UpdateUserData = { updatedAt: new Date() };

    if (input.fullName !== undefined) updates.fullName = input.fullName;
    if (input.email !== undefined) updates.email = input.email;
    if (input.role !== undefined) updates.role = input.role;

    if (updates.email) {
    const existing = await this.repo.findByEmail(updates.email);
    if (existing && existing.id !== userId) {
        throw new AppError('Email already in use', 409);
    }
    }

    const updated = await this.repo.update(userId, updates);
    if (!updated) throw new AppError('User not found', 404);

    const { password, ...safe } = updated;
    return safe;
    }


    async deleteUserByAdmin(userId: string): Promise<void> {
        const existing = await this.repo.findById(userId);
        if (!existing) throw new AppError('User not found', 404);

        await this.repo.delete(userId);
    }

}
