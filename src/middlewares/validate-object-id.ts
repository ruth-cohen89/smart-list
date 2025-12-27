// middlewares/validate-object-id.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/app-error';

export const validateObjectId = (paramName: string = 'id') =>
    (req: Request, _res: Response, next: NextFunction) => {
        const value = req.params[paramName];

        if (!mongoose.Types.ObjectId.isValid(value)) {
            return next(new AppError(`Invalid ${paramName}`, 400));
        }

        next();
    };
