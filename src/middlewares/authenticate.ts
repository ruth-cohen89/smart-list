import { Request, Response, NextFunction } from 'express';
import { catchAsync } from './catch-async';
import { userRepository } from '../repositories/user.repository'

import { verifyToken } from '../utils/jwt';
import { handleNotLoggedIn, handleUserNotFound, handlePasswordChanged } from '../errors/auth-handlers';

const changedPasswordAfter = (passwordChangedAt: Date | string | undefined, tokenIat: number) => {
    if (!passwordChangedAt) return false;
    const changedAt = new Date(passwordChangedAt).getTime() / 1000;
    return changedAt > tokenIat;
};


export const authenticate = catchAsync(async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }


    if (!token) return next(handleNotLoggedIn());

    const decoded = await verifyToken(token);


    const currentUser = await userRepository.findById(decoded.id);
    if (!currentUser) return next(handleUserNotFound());

    if (changedPasswordAfter(currentUser.passwordChangedAt, decoded.iat)) {
        return next(handlePasswordChanged());
    }

    req.user = currentUser;
    res.locals.user = currentUser;
    next();
});
