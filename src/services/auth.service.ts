import bcrypt from 'bcrypt'
import { AuthRepository } from '../repositories/auth.repository'
import { User } from '../models/user.model'
import { generateToken } from '../utils/jwt';

export class AuthService {
    constructor(private readonly repo: AuthRepository) {
    }

    async signUp(user: User) {
        const existingUser = await this.repo.findByEmail(user.email);
        if (existingUser) {
            throw new Error('Email already in use');
        }

        const hashedPassword = await bcrypt.hash(user.password, 10);

        const createdUser = await this.repo.signUp({
            ...user,
            password: hashedPassword,
        });

        const token = generateToken({
            id: createdUser.id,
            role: createdUser.role,
        });

        const { password, ...safeUser } = createdUser;


        return {
            user: safeUser,
            token,
        };
    }
}
