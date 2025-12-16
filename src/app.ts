import express, {Request, Response, NextFunction } from 'express'
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mainRouter from './routes/main.routes';

export const createApp = () => {
    const app = express()

    app.use(helmet());
    app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(compression());

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests, please try again later.'
    });
    app.use(limiter);

    app.use('/api/v1', mainRouter)

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        console.error(err.stack);
        res.status(500).json({ message: 'Internal Server Error' });
    });

    return app
}
