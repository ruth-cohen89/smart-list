import { User } from '../models/user.model'
import UserModel from '../infrastructure/db/user.mongoose.model'
import { CreateUserData } from '../types/User';


export interface UserRepository {
    findAll(): Promise<User[]>
    findById(id: string): Promise<User | null>
    findByEmail(email: string): Promise<User | null>
    create(data: CreateUserData): Promise<User>
    update(userId: string, updates: Partial<User>): Promise<User>
    delete(id: string): Promise<void>
}

export class UserMongoRepository implements UserRepository {

    private mapUser(u: any): User {
        return {
            id: u._id.toString(),
            fullName: u.fullName,
            email: u.email,
            password: u.password,
            role: u.role,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
        }
    }

    async findAll(): Promise<User[]> {
        const users = await UserModel.find().lean()
        return users.map(u => this.mapUser(u))
    }

    async findById(id: string): Promise<User | null> {
        const u = await UserModel.findById(id).lean()
        if (!u) return null
        return this.mapUser(u)
    }

    async findByEmail(email: string): Promise<User | null> {
        const u = await UserModel.findOne({ email }).lean();
        if (!u) return null;
        return this.mapUser(u);
    }

    async create(data: CreateUserData): Promise<User> {
        const created = await UserModel.create({
            fullName: data.fullName,
            email: data.email,
            password: data.password, // already hashed
            role: data.role,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return this.mapUser(created);
    }


    async update(userId: string, updates: Partial<User>): Promise<User> {
        const updated = await UserModel.findByIdAndUpdate(userId, updates, { new: true }).lean();
        if (!updated) throw new Error('User not found');
        return this.mapUser(updated);
    }


    async delete(id: string): Promise<void> {
        await UserModel.findByIdAndDelete(id)
    }
}

export const userRepository = new UserMongoRepository();