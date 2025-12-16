import { Router } from 'express'
import userRouter from './user.routes'
import authRouter from "./auth.routes";
import healthRouter from "./health.routes";
// import shoppingRouter from './shopping.router'

const router = Router()

router.use('/users', userRouter)
router.use("/auth", authRouter);
router.use("/health", healthRouter);

// router.use('/shopping', shoppingRouter)

export default router
