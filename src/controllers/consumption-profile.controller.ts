import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { ConsumptionProfileService } from '../services/consumption-profile.service';

import type {
  CreateBaselineItemInput,
  // UpdateBaselineItemInput,
  UpsertConsumptionProfileInput,
} from '../types/consumption-profile';

export class ConsumptionProfileController {
  constructor(private readonly service: ConsumptionProfileService) {}

  getMyProfile = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const profile = await this.service.getOrCreate(req.user.id);
    res.status(200).json(profile);
  });

  upsertFromQuestionnaire = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = req.body as UpsertConsumptionProfileInput;
    const profile = await this.service.upsertFromQuestionnaire(req.user.id, dto);

    res.status(200).json(profile);
  });

  addBaselineItem = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const dto = req.body as CreateBaselineItemInput;
    const updated = await this.service.addBaselineItem(req.user.id, dto);

    res.status(201).json(updated);
  });

  // updateBaselineItem = catchAsync(async (req: Request, res: Response) => {
  //   if (!req.user) throw new AppError('Not authenticated', 401);

  //   const dto = req.body as UpdateBaselineItemInput;
  //   const updated = await this.service.updateBaselineItem(req.user.id, req.params.itemId, dto);

  //   res.status(200).json(updated);
  // });

  // deleteBaselineItem = catchAsync(async (req: Request, res: Response) => {
  //   if (!req.user) throw new AppError('Not authenticated', 401);

  //   const updated = await this.service.deleteBaselineItem(req.user.id, req.params.itemId);
  //   res.status(200).json(updated);
  // });
}
