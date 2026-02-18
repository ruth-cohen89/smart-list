// shopping-lists.routes.ts
import { Router } from 'express';
import { ShoppingListController } from '../controllers/shopping-list.controller';
import { ShoppingListService } from '../services/shopping-list.service';
import { ConsumptionProfileService } from '../services/consumption-profile.service';
import { authenticate } from '../middlewares/authenticate';
import { validateObjectId } from '../middlewares/validate-object-id';
import { validateBody } from '../middlewares/validate-body';

import {
  updateShoppingListSchema,
  createItemSchema,
  updateItemSchema,
} from '../validations/shopping-list';

const service = new ShoppingListService();
const consumptionProfileService = new ConsumptionProfileService();
const controller = new ShoppingListController(service, consumptionProfileService);

const router = Router();

// Active list
router.get('/active', authenticate, controller.getActiveList);

router.patch(
  '/active',
  authenticate,
  validateBody(updateShoppingListSchema),
  controller.updateActiveList,
);

// Items (in active list)
router.post(
  '/active/items',
  authenticate,
  validateBody(createItemSchema),
  controller.addItemToActiveList,
);

router.patch(
  '/active/items/:itemId',
  authenticate,
  validateObjectId('itemId'),
  validateBody(updateItemSchema),
  controller.updateItemInActiveList,
);

router.delete(
  '/active/items/:itemId',
  authenticate,
  validateObjectId('itemId'),
  controller.deleteItemFromActiveList,
);

router.post(
  '/active/items/:itemId/toggle',
  authenticate,
  validateObjectId('itemId'),
  controller.toggleItemPurchasedInActiveList,
);

export default router;
