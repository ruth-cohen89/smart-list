import { Router } from 'express';
import { PriceComparisonController } from '../controllers/price-comparison.controller';
import { PriceComparisonService } from '../services/price-comparison.service';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { ProductRepository } from '../repositories/product.repository';
import { authenticate } from '../middlewares/authenticate';

const shoppingListRepo = new ShoppingListRepository();
const chainProductRepo = new ChainProductRepository();
const productRepo = new ProductRepository();
const service = new PriceComparisonService(shoppingListRepo, chainProductRepo, productRepo);
const controller = new PriceComparisonController(service);

const router = Router();

// Compare the authenticated user's active shopping list against all supported chains.
// Returns per-chain basket totals, matched/unmatched items, and the cheapest chain.
router.get('/compare-active', authenticate, controller.compareActiveList);

export default router;
