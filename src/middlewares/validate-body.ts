import { ZodSchema } from 'zod';
import { AppError } from '../errors/app-error';

export const validateBody =
    (schema: ZodSchema) =>
        (req: any, _res: any, next: any) => {
            const result = schema.safeParse(req.body);

            if (!result.success) {
                const issue = result.error.issues[0];

                const message =
                    issue?.message ||
                    `Invalid field: ${issue?.path.join('.') || 'body'}`;

                return next(new AppError(message, 400));
            }

            req.body = result.data;
            next();
        };

