import { Router } from 'express';
import { CatalogImportController } from '../controllers/catalog-import.controller';
import { CatalogImportService } from '../services/catalog-import.service';
import { ChainProductRepository } from '../repositories/chain-product.repository';

const chainProductRepo = new ChainProductRepository();
const service = new CatalogImportService(chainProductRepo);
const controller = new CatalogImportController(service);

const router = Router();

// TODO: Protect these routes before making them public.
// For now they are unprotected internal triggers (dev/ops use only).
// When the Cloud Run Job is implemented, it will call these with a service-account token.

// Trigger import for all supported chains (sequential, safe)
router.post('/run-all', controller.importAllChains);

// Trigger import for a single chain
// run-all must be registered before :chainId to avoid being swallowed as a param
router.post('/:chainId', controller.importChain);

export default router;
