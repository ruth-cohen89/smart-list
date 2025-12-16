import { Request, Response } from 'express'
import { UserService } from '../services/user.service'
import { UpdateProfileDTO } from "../types/User";


export class UserController {
    constructor(private readonly service: UserService) {}

    getAll = async (req: Request, res: Response) => {
        const users = await this.service.getAllUsers()
        res.json(users)
    }

    getById = async (req: Request, res: Response) => {
        const user = await this.service.getUserById(req.params.id)
        res.json(user)
    }

    getByEmail = async (req: Request, res: Response) => {
        const user = await this.service.getUserByEmail(req.params.email)
        res.json(user)
    }

    createUser = async (req: Request, res: Response) => {
        const user = await this.service.createUser(req.body, "user");
        res.json(user);
    };

    createAdmin = async (req: Request, res: Response) => {
        const user = await this.service.createUser(req.body, "admin");
        res.json(user);
    };

    // updateProfile = async (req: Request, res: Response) => {
    //     const userId = req.user.id;
    //     const updates = req.body;
    //     const updatedUser = await this.service.updateProfile(userId, updates);
    //     res.json(updatedUser);
    // };


    delete = async (req: Request, res: Response) => {
        await this.service.deleteUser(req.params.id)
        res.sendStatus(204)
    }
}
