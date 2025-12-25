import { User } from '../models/user.model'
import UserModel from '../infrastructure/db/user.mongoose.model'
import { CreateUserInput } from '../types/User'

export interface AuthRepository {
    signUp(user: CreateUserInput): Promise<User>
    findByEmail(email: string): Promise<User | null>;
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
        }
    }

    async findByEmail(email: string): Promise<User | null> {
        const user = await UserModel.findOne({ email }).lean();
        return user ? this.mapUser(user) : null;
    }


    async signUp(user: CreateUserInput): Promise<User> {
        try {
            const created = await UserModel.create({ ...user })
            return this.mapUser(created)
        } catch(err:any) {
            throw err;
        }

    }

}
