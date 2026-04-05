import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { CatalogImportController } from '../controllers/catalog-import.controller';
import { CatalogImportService } from '../services/catalog-import.service';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { AppError } from '../errors/app-error';

const chainProductRepo = new ChainProductRepository();
const service = new CatalogImportService(chainProductRepo);
const controller = new CatalogImportController(service);

// ── Import secret guard ───────────────────────────────────────────────────────
// Rejects requests that don't carry the correct x-import-secret header.
// Set IMPORT_SECRET in your env file. If not set, the guard is skipped (dev convenience).
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

// Trigger import for all supported chains (sequential, safe)
router.post('/run-all', controller.importAllChains);

// Trigger import for a single chain
// run-all must be registered before :chainId to avoid being swallowed as a param
router.post('/:chainId', controller.importChain);

export default router;
