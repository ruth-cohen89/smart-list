import { userRepository } from '../repositories/user.repository';
import { CreateUserInput, Role } from '../types/User';
import { User } from '../models/user.model'
import bcrypt from 'bcrypt'
import { AppError } from "../errors/app-error";

export class UserService {
    private repo = userRepository;

    getAllUsers(): Promise<User[]> {
        return this.repo.findAll()
    }

    getUserById(id: string): Promise<User | null> {
        return this.repo.findById(id)
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

        deleteUser(id: string): Promise<void> {
        return this.repo.delete(id)
    }
}
