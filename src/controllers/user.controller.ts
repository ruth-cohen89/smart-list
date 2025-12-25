import { Request, Response } from 'express'
import { UserService } from '../services/user.service'
//import { UpdateProfileDTO } from "../types/User";
import { catchAsync } from '../middlewares/catch-async'

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

    getByEmail = catchAsync(async (req: Request, res: Response) => {
        const user = await this.service.getUserByEmail(req.params.email)
        res.json(user)
    })

    createUser = catchAsync(async (req: Request, res: Response) => {
        const user = await this.service.createUser(req.body, "user");
        res.json(user);
    });

    createAdmin = catchAsync(async (req: Request, res: Response) => {
        const user = await this.service.createUser(req.body, "admin");
        res.json(user);
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
