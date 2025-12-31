import { Router } from 'express';
import authRouter from './auth.routes';
import userRouter from './user.routes';
import shoppingListRouter from './shopping-list.routes';
import healthRouter from './health.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/shopping-lists', shoppingListRouter);
router.use('/health', healthRouter);


export default router;
