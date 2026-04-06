import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import { PromoImportService } from '../services/promo-import.service';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';

export class PromoImportController {
  constructor(private readonly service: PromoImportService) {}

  /**
   * POST /api/v1/promo-import/:chainId
   * Trigger a promo import for a single chain.
   */
  importChain = catchAsync(async (req: Request, res: Response) => {
    const { chainId } = req.params;

    if (!SUPPORTED_CHAINS.includes(chainId as ChainId)) {
      throw new AppError(
        `Unsupported chainId "${chainId}". Supported: ${SUPPORTED_CHAINS.join(', ')}`,
        400,
      );
    }

    const result = await this.service.importChain(chainId as ChainId);
    res.status(result.success ? 200 : 502).json(result);
  });

  /**
   * POST /api/v1/promo-import/run-all
   * Trigger a promo import for all supported chains sequentially.
   */
  importAllChains = catchAsync(async (_req: Request, res: Response) => {
    const results = await this.service.importAllChains();
    const allSucceeded = results.every((r) => r.success);
    res.status(allSucceeded ? 200 : 207).json({ results });
  });
}
