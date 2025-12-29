import { ZodSchema } from 'zod';
import { AppError } from '../errors/app-error';

export const validateBody =
    (schema: ZodSchema) =>
        (req: any, _res: any, next: any) => {
            const result = schema.safeParse(req.body);

            if (!result.success) {
                const msg = result.error.issues[0]?.message ?? 'Invalid request body';
                return next(new AppError(msg, 400));
            }

            // return body after trim/toLowerCase
            req.body = result.data;
            next();
        };
