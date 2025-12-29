import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import { catchAsync } from '../middlewares/catch-async'
import { AppError } from '../errors/app-error';
import { ChangePasswordInput, ForgotPasswordInput, ResetPasswordInput } from '../types/auth';


export class AuthController {
    constructor(private readonly service: AuthService) {
    }

    changePassword = catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Not authenticated', 401);
        const input = req.body as ChangePasswordInput;

        const result = await this.service.changePassword(req.user.id, input);
        res.json(result);
    });

    forgotPassword = catchAsync(async (req: Request, res: Response) => {
        const input = req.body as ForgotPasswordInput;
        const result = await this.service.forgotPassword(input);
        res.json(result); // { resetToken }
    });



    resetPassword = catchAsync(async (req: Request, res: Response) => {
        const input = req.body as ResetPasswordInput;

        const result = await this.service.resetPassword(input);
        res.json(result); // { token }
    });

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