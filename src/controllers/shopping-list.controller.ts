// shopping-list.controller.ts
import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { ShoppingListService } from '../services/shopping-list.service';
import { ConsumptionProfileService } from '../services/consumption-profile.service';

import {
  updateShoppingListSchema,
  createItemSchema,
  updateItemSchema,
} from '../validations/shopping-list';

export class ShoppingListController {
  constructor(
    private readonly service: ShoppingListService,
    // kept for future (baseline sync etc.) - not used in MVP routes right now
    private readonly consumptionProfileService: ConsumptionProfileService,
  ) {}

  getActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const list = await this.service.getOrCreateActiveList(req.user.id);
    res.status(200).json(list);
  });

  updateActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = updateShoppingListSchema.parse(req.body);
    const updated = await this.service.updateActiveList(req.user.id, dto);

    res.status(200).json(updated);
  });

  addItemToActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = createItemSchema.parse(req.body);
    const updated = await this.service.addItemToActiveList(req.user.id, dto);

    res.status(200).json(updated);
  });

  updateItemInActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = updateItemSchema.parse(req.body);
    const updated = await this.service.updateItemInActiveList(req.user.id, req.params.itemId, dto);

    res.status(200).json(updated);
  });

  deleteItemFromActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const updated = await this.service.deleteItemFromActiveList(req.user.id, req.params.itemId);

    res.status(200).json(updated);
  });

  toggleItemPurchasedInActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const updated = await this.service.togglePurchasedInActiveList(req.user.id, req.params.itemId);

    res.status(200).json(updated);
  });
}
