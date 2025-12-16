import { User } from '../models/user.model'
import UserModel from '../infrastructure/db/user.mongoose.model'
import bcrypt from 'bcrypt'

export interface AuthRepository {
    signUp(user: User): Promise<User>
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

    async signUp(user: User): Promise<User> {
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(user.password, saltRounds)
        const created = await UserModel.create({ ...user, password: hashedPassword })
        return this.mapUser(created)
    }


}
