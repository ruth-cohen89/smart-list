import { Router } from 'express';
import { ShoppingListController } from '../controllers/shopping-list.controller';
import { ShoppingListService } from '../services/shopping-list.service';
import { authenticate } from '../middlewares/authenticate';
import { validateObjectId } from '../middlewares/validate-object-id';
import { validateBody } from '../middlewares/validate-body';

import {
    createShoppingListSchema,
    updateShoppingListSchema,
    createItemSchema,
    updateItemSchema,
} from '../validations/shopping-list';

const service = new ShoppingListService();
const controller = new ShoppingListController(service);

const router = Router();

// Lists
router.post(
    '/from-baseline',
    authenticate,
    controller.createFromBaseline
);

router.post(
    '/',
    authenticate,
    validateBody(createShoppingListSchema),
    controller.createList
);

router.get(
    '/',
    authenticate,
    controller.getMyLists
);

router.get(
    '/:listId',
    authenticate,
    validateObjectId('listId'),
    controller.getList
);

router.patch(
    '/:listId',
    authenticate,
    validateObjectId('listId'),
    validateBody(updateShoppingListSchema),
    controller.updateList
);

router.delete(
    '/:listId',
    authenticate,
    validateObjectId('listId'),
    controller.deleteList
);

// Items
router.post(
    '/:listId/items',
    authenticate,
    validateObjectId('listId'),
    validateBody(createItemSchema),
    controller.addItem
);

router.patch(
    '/:listId/items/:itemId',
    authenticate,
    validateObjectId('listId'),
    validateObjectId('itemId'),
    validateBody(updateItemSchema),
    controller.updateItem
);

router.delete(
    '/:listId/items/:itemId',
    authenticate,
    validateObjectId('listId'),
    validateObjectId('itemId'),
    controller.deleteItem
);

router.post(
    '/:listId/items/:itemId/toggle',
    authenticate,
    validateObjectId('listId'),
    validateObjectId('itemId'),
    controller.toggleItemPurchased
);

export default router;
