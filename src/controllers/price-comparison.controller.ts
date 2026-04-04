import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { PriceComparisonService } from '../services/price-comparison.service';

export class PriceComparisonController {
  constructor(private readonly service: PriceComparisonService) {}

  compareActiveList = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const result = await this.service.compareActiveList(req.user.id);

    res.status(200).json(result);
  });
}
