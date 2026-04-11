import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { ProductService } from '../services/product.service';

export class ProductController {
  constructor(private readonly service: ProductService) {}

  search = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await this.service.search(q);

    res.status(200).json({ results });
  });
}
