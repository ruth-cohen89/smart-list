import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { ProductService } from '../services/product.service';
import { authenticate } from '../middlewares/authenticate';

const service = new ProductService();
const controller = new ProductController(service);

const router = Router();

router.use(authenticate);

// GET /api/v1/products/search?q=...
router.get('/search', controller.search);

export default router;
