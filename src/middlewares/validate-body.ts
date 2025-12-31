import { ZodSchema } from 'zod';
import { AppError } from '../errors/app-error';

export const validateBody =
    (schema: ZodSchema) =>
        (req: any, _res: any, next: any) => {
            const body = req.body ?? {};

            const result = schema.safeParse(body);

            if (!result.success) {
                const msg = result.error.issues[0]?.message ?? 'Invalid request body';
                return next(new AppError(msg, 400));
            }

            req.body = result.data;
            next();
        };
