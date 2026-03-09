import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../errors/app-error';

export const validateBody =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issue = result.error.issues[0];

      const message = issue?.message || `Invalid field: ${issue?.path.join('.') || 'body'}`;

      return next(new AppError(message, 400));
    }

    req.body = result.data;
    next();
  };
