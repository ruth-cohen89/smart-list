import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { CatalogImportController } from '../controllers/catalog-import.controller';
import { CatalogImportService } from '../services/catalog-import.service';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductResolutionService } from '../services/product-resolution.service';
import { AppError } from '../errors/app-error';

const chainProductRepo = new ChainProductRepository();
const productRepo = new ProductRepository();
const productResolution = new ProductResolutionService(productRepo);
const service = new CatalogImportService(chainProductRepo, productResolution);
const controller = new CatalogImportController(service);

function requireImportSecret(req: Request, _res: Response, next: NextFunction) {
  const secret = process.env.IMPORT_SECRET;
  if (!secret) return next();

  if (req.headers['x-import-secret'] !== secret) {
    throw new AppError('Forbidden: invalid or missing x-import-secret', 403);
  }

  next();
}

const router = Router();

router.use(requireImportSecret);
router.post('/run-all', controller.importAllChains);
router.post('/:chainId', controller.importChain);

export default router;
