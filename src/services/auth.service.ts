import bcrypt from 'bcrypt'
import { AuthRepository } from '../repositories/auth.repository'
import { generateToken } from '../utils/jwt';
import { handleMissingCredentials, handleInvalidCredentials } from '../errors/auth-handlers';
import { SignupInput, LoginInput} from "../types/auth";
import { handleMissingSignupFields } from '../errors/auth-handlers';



export class AuthService {
    constructor(private readonly repo: AuthRepository) {
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

        console.log('token', token)

        const {password: _pw, ...safeUser } = createdUser;


        return {
            user: safeUser,
            token,
        };
    }

    async login({ email, password }: LoginInput) {
        console.log('login service');
        if (!email || !password) throw handleMissingCredentials();

        const user = await this.repo.findByEmail(email);

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
