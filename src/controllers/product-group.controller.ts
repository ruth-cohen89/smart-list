import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { ProductGroupService } from '../services/product-group.service';

export class ProductGroupController {
  constructor(private readonly service: ProductGroupService) {}

  search = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await this.service.search(q);

    res.status(200).json({
      results: results.map((g) => ({
        id: g.id,
        name: g.name,
        department: g.department,
        category: g.category,
        selectionMode: g.selectionMode,
      })),
    });
  });

  listAll = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const groups = await this.service.listAll();

    res.status(200).json({ groups });
  });

  getVariants = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const { groupId } = req.params;
    const variants = await this.service.getVariants(groupId);

    res.status(200).json({ variants });
  });

  mapToProducts = catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError('Not authenticated', 401);

    const { groupId } = req.params;
    const variantId = typeof req.query.variantId === 'string' ? req.query.variantId : undefined;

    const result = await this.service.mapToProducts(groupId, variantId);

    res.status(200).json(result);
  });
}
