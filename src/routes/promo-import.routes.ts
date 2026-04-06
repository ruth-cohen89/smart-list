import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { PromoImportController } from '../controllers/promo-import.controller';
import { PromoImportService } from '../services/promo-import.service';
import { PromotionRepository } from '../repositories/promotion.repository';
import { AppError } from '../errors/app-error';

const promoRepo = new PromotionRepository();
const service = new PromoImportService(promoRepo);
const controller = new PromoImportController(service);

// ── Import secret guard (same as catalog-import) ──────────────────────────────
function requireImportSecret(req: Request, _res: Response, next: NextFunction) {
  const secret = process.env.IMPORT_SECRET;
  if (!secret) return next(); // not configured — allow (dev only)

  if (req.headers['x-import-secret'] !== secret) {
    throw new AppError('Forbidden: invalid or missing x-import-secret', 403);
  }
  next();
}

const router = Router();

router.use(requireImportSecret);

// run-all must be registered before /:chainId to avoid being swallowed as a param
router.post('/run-all', controller.importAllChains);
router.post('/:chainId', controller.importChain);

export default router;
