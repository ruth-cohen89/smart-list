import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { AuthMongoRepository } from '../repositories/auth.repository';
import { authenticate } from '../middlewares/authenticate';
import { validateBody } from '../middlewares/validate-body';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../validations/auth.schemas';

const repo = new AuthMongoRepository();
const service = new AuthService(repo);
const controller = new AuthController(service);

const router = Router();

router.patch(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  controller.changePassword,
);
router.post('/forgot-password', validateBody(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), controller.resetPassword);

router.post('/signup', validateBody(signupSchema), controller.signUp);
router.post('/login', validateBody(loginSchema), controller.login);

export default router;
