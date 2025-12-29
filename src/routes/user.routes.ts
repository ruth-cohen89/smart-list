import { Router } from 'express'
import { UserController } from '../controllers/user.controller'
import { UserService } from '../services/user.service'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from "../middlewares/authorize";
import { validateObjectId } from '../middlewares/validate-object-id';
import { validateBody } from '../middlewares/validate-body';

import {
    createUserSchema,
    updateUserSchema,
    updateMeSchema,
} from '../validations/user.validation';

const service = new UserService()
const controller = new UserController(service)

const router = Router()

router.get('/me', authenticate, controller.getMe);
router.patch('/me', authenticate, validateBody(updateMeSchema), controller.updateMe);
router.delete('/me', authenticate, controller.deleteMe);

// admin routes
router.post('/', authenticate, authorize('admin'), validateBody(createUserSchema), controller.create);
router.get('/', authenticate, authorize('admin'), controller.getAll)
router.get('/:id', authenticate, authorize('admin'), validateObjectId('id'),controller.getById)
router.patch('/:id', authenticate, authorize('admin'), validateObjectId('id'), validateBody(updateUserSchema), controller.update);
router.delete('/:id', authenticate, authorize('admin'), validateObjectId('id'), controller.delete);

export default router
