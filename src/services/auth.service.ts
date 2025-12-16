import { AuthRepository } from '../repositories/auth.repository'
import { User } from '../models/user.model'

export class AuthService {
    constructor(private readonly repo: AuthRepository) {
    }

    async signUp(user: User): Promise<User> {
        return this.repo.signUp(user)
    }
}
