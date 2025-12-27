import { Request, Response } from 'express'
import { UserService } from '../services/user.service'
import { catchAsync } from '../middlewares/catch-async'
import { CreateUserInput } from '../types/User';

export class UserController {
    constructor(private readonly service: UserService) {}

    getAll = catchAsync(async (_req: Request, res: Response) => {
        const users = await this.service.getAllUsers()
        res.json(users)
    });

    getById = catchAsync(async (req: Request, res: Response) => {
        const user = await this.service.getUserById(req.params.id)
        res.json(user)
    });


    create = catchAsync(async (req: Request, res: Response) => {
        const input = req.body as CreateUserInput;
        const user = await this.service.createUserByAdmin(input);
        res.status(201).json(user);
    });

    // updateProfile = catchAsync(async (req: Request, res: Response) => {
    //     const userId = req.user.id;
    //     const updates = req.body;
    //     const updatedUser = await this.service.updateProfile(userId, updates);
    //     res.json(updatedUser);
    // });


    delete = catchAsync(async (req: Request, res: Response) => {
        await this.service.deleteUser(req.params.id)
        res.sendStatus(204)
    });
}
