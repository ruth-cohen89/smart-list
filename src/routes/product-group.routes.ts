import { Router } from 'express';
import { ProductGroupController } from '../controllers/product-group.controller';
import { ProductGroupService } from '../services/product-group.service';
import { authenticate } from '../middlewares/authenticate';

const service = new ProductGroupService();
const controller = new ProductGroupController(service);

const router = Router();

router.use(authenticate);

// GET /api/v1/product-groups/search?q=...
router.get('/search', controller.search);

// GET /api/v1/product-groups
router.get('/', controller.listAll);

// GET /api/v1/product-groups/:groupId/variants
router.get('/:groupId/variants', controller.getVariants);

// GET /api/v1/product-groups/:groupId/map?variantId=...
router.get('/:groupId/map', controller.mapToProducts);

export default router;
