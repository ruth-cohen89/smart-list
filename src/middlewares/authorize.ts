import { Request, Response, NextFunction } from 'express';
import { handleUnauthorizedRole } from '../errors/auth-handlers';
import { handleInvalidToken } from '../errors/auth-handlers';

type AuthUser = {
  role: 'user' | 'admin';
};

export const authorize = (...roles: string[]) => {
  return (req: Request & { user?: AuthUser }, _res: Response, next: NextFunction) => {
    if (!req.user) return next(handleInvalidToken());
    if (!roles.includes(req.user.role)) return next(handleUnauthorizedRole());
    return next();
  };
};
