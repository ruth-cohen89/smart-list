import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import { catchAsync } from '../middlewares/catch-async'

export class AuthController {
    constructor(private readonly service: AuthService) {
    }

    signUp = catchAsync(async (req, res) => {
        const result = await this.service.signUp({
            fullName: req.body.fullName,
            email: req.body.email,
            password: req.body.password,
        });
        res.status(201).json(result);
    });

    login = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
        const result = await this.service.login({
            email: req.body.email,
            password: req.body.password,
        });

        res.status(200).json(result);
    });
}