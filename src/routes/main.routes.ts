import { Router } from 'express'
import userRouter from './user.routes'
import healthRouter from "./health.routes";
// import shoppingRouter from './shopping.router'

const router = Router()

router.use("/health", healthRouter);
router.use('/users', userRouter)
// router.use('/shopping', shoppingRouter)

export default router
