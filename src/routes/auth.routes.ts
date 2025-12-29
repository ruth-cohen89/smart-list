import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { AuthService } from '../services/auth.service'
import { AuthMongoRepository } from '../repositories/auth.repository'
import { authenticate } from '../middlewares/authenticate';

const repo = new AuthMongoRepository()
const service = new AuthService(repo)
const controller = new AuthController(service)


const router = Router()

router.patch('/change-password', authenticate, controller.changePassword);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);

router.post('/signup',  controller.signUp)
router.post('/login', controller.login)


export default router
