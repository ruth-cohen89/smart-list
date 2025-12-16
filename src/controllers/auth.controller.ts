import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service'

export class AuthController {
    constructor(private readonly service: AuthService) {
    }

    signUp = async (req: Request, res: Response) => {
        const user = await this.service.signUp(req.body)
        res.json(user)
    }
}