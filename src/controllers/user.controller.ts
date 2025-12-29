import { Request, Response } from 'express'
import { UserService } from '../services/user.service'
import { catchAsync } from '../middlewares/catch-async'
import { AppError } from '../errors/app-error';

import { CreateUserDTO, UpdateMeDTO, UpdateUserDTO } from '../validations/user.validation';

export class UserController {
    constructor(private readonly service: UserService) {}

    getMe = catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Not authenticated', 401);

        const user = await this.service.getMe(req.user.id);
        res.json(user);
    });

    updateMe = catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Not authenticated', 401);

        const input: UpdateMeDTO = req.body;
        const user = await this.service.updateMe(req.user.id, input);
        res.json(user);
    });

    deleteMe = catchAsync(async (req: Request, res: Response) => {
        if (!req.user) throw new AppError('Not authenticated', 401);

        await this.service.deleteMe(req.user.id);
        res.sendStatus(204);
    });

    getAll = catchAsync(async (_req: Request, res: Response) => {
        const users = await this.service.getAllUsers()
        res.json(users)
    });

    getById = catchAsync(async (req: Request, res: Response) => {
        const user = await this.service.getUserById(req.params.id)
        res.json(user)
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const input: CreateUserDTO = req.body;
        const user = await this.service.createUserByAdmin(input);
        res.status(201).json(user);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const input: UpdateUserDTO = req.body;
        const user = await this.service.updateUserByAdmin(req.params.id, input);
        res.json(user);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.service.deleteUserByAdmin(req.params.id);
        res.sendStatus(204);
    });
}
