import { UserRepository } from '../repositories/user.repository'
import { User } from '../models/user.model'
import { UpdateProfileDTO } from "../types/User";


export class UserService {
    constructor(private readonly repo: UserRepository) {}

    getAllUsers(): Promise<User[]> {
        return this.repo.findAll()
    }

    getUserById(id: string): Promise<User | null> {
        return this.repo.findById(id)
    }

    getUserByEmail(email: string): Promise<User | null> {
        return this.repo.findByEmail(email)
    }

    async createUser(user: User, role: "user" | "admin"): Promise<User> {
        return this.repo.create(user, role);
    }

    async updateProfile(userId: string, updates: UpdateProfileDTO): Promise<User> {
        const filteredUpdates: UpdateProfileDTO = {};

        if (updates.fullName !== undefined) filteredUpdates.fullName = updates.fullName;
        if (updates.email !== undefined) filteredUpdates.email = updates.email;

        return this.repo.update(userId, filteredUpdates);
    }

    deleteUser(id: string): Promise<void> {
        return this.repo.delete(id)
    }
}
