import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { catchAsync } from '../middlewares/catch-async';
import { AppError } from '../errors/app-error';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  changePassword = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);
    const result = await this.service.changePassword(req.user.id, req.body);
    res.json(result);
  });

  forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const result = await this.service.forgotPassword(req.body);
    res.json(result);
  });

  resetPassword = catchAsync(async (req: Request, res: Response) => {
    const result = await this.service.resetPassword(req.body);
    res.json(result);
  });

  signUp = catchAsync(async (req: Request, res: Response) => {
    const result = await this.service.signUp(req.body);
    res.status(201).json(result);
  });

  login = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await this.service.login(req.body);
    res.status(200).json(result);
  });
}
