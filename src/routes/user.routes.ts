import { Router } from 'express'
import { UserController } from '../controllers/user.controller'
import { UserService } from '../services/user.service'
import { UserMongoRepository } from '../repositories/user.repository'

const repo = new UserMongoRepository()
const service = new UserService(repo)
const controller = new UserController(service)
// import { requireRole } from "../middlewares/roleMiddleware";

const router = Router()

router.get('/', controller.getAll)
router.get('/:id', controller.getById)
// TODO: allow only admin to use this route based on the logged-in user that needs to be identified by JWT
// router.post('/', authMiddleware, requireRole("admin"), controller.createUser)
// router.post('/admin', authMiddleware, requireRole("admin"), controller.createAdmin);

router.post('/', controller.createUser)

// TODO
//router.patch('/:id', authMiddleware, requireRole("admin"), controller.requireRole("admin"),)
//router.delete('/:id',  controller.delete)

//TODO
//router.patch('/profile', controller.updateProfile)

export default router
