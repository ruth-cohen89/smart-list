import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { ShoppingListService } from '../services/shopping-list.service';

import {
  createShoppingListSchema,
  updateShoppingListSchema,
  createItemSchema,
  updateItemSchema,
} from '../validations/shopping-list';

export class ShoppingListController {
  constructor(private readonly service: ShoppingListService) {}

  createFromBaseline = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const name = typeof req.body?.name === 'string' ? req.body.name : 'My shopping list';

    const list = await this.service.createFromBaseline(req.user.id, { name });
    res.status(201).json(list);
  });

  createList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = createShoppingListSchema.parse(req.body);

    const list = await this.service.createList(req.user.id, dto);
    res.status(201).json(list);
  });

  getMyLists = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const lists = await this.service.getMyLists(req.user.id);
    res.status(200).json(lists);
  });

  getList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const list = await this.service.getList(req.user.id, req.params.listId);
    res.status(200).json(list);
  });

  updateList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = updateShoppingListSchema.parse(req.body);

    const updated = await this.service.updateList(req.user.id, req.params.listId, dto);
    res.status(200).json(updated);
  });

  deleteList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const result = await this.service.deleteList(req.user.id, req.params.listId);
    res.status(200).json(result);
  });

  addItem = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = createItemSchema.parse(req.body);

    const updated = await this.service.addItem(req.user.id, req.params.listId, dto);
    res.status(200).json(updated);
  });

  updateItem = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = updateItemSchema.parse(req.body);

    const updated = await this.service.updateItem(
      req.user.id,
      req.params.listId,
      req.params.itemId,
      dto,
    );

    res.status(200).json(updated);
  });

  deleteItem = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const updated = await this.service.deleteItem(
      req.user.id,
      req.params.listId,
      req.params.itemId,
    );
    res.status(200).json(updated);
  });

  toggleItemPurchased = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const updated = await this.service.togglePurchased(
      req.user.id,
      req.params.listId,
      req.params.itemId,
    );
    res.status(200).json(updated);
  });
}
