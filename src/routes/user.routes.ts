import { Router } from 'express'
import { UserController } from '../controllers/user.controller'
import { UserService } from '../services/user.service'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from "../middlewares/authorize";

const service = new UserService()
const controller = new UserController(service)

const router = Router()

router.post('/', authenticate,authorize('admin'), controller.create);
router.get('/', authenticate, authorize('admin'), controller.getAll)
router.get('/:id', authenticate, authorize('admin'), controller.getById)


// TODO
//router.patch('/:id', authMiddleware, requireRole("admin"), controller.requireRole("admin"),)
//router.delete('/:id',  controller.delete)

//TODO: ME routes
//router.patch('/profile', controller.updateProfile)

export default router
