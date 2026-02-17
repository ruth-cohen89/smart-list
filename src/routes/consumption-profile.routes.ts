import { Router } from 'express';
import { ConsumptionProfileController } from '../controllers/consumption-profile.controller';
import { ConsumptionProfileService } from '../services/consumption-profile.service';
import { authenticate } from '../middlewares/authenticate';
import { validateObjectId } from '../middlewares/validate-object-id';
import { validateBody } from '../middlewares/validate-body';

import {
  createBaselineItemSchema,
  updateBaselineItemSchema,
  upsertConsumptionProfileSchema,
} from '../validations/consumption-profile';

const service = new ConsumptionProfileService();
const controller = new ConsumptionProfileController(service);

const router = Router();

router.put(
  '/',
  authenticate,
  validateBody(upsertConsumptionProfileSchema),
  controller.upsertFromQuestionnaire,
);

// Profile (get or create)
router.get('/', authenticate, controller.getMyProfile);

// Baseline items
router.post(
  '/baseline-items',
  authenticate,
  validateBody(createBaselineItemSchema),
  controller.addBaselineItem,
);

router.patch(
  '/baseline-items/:itemId',
  authenticate,
  validateObjectId('itemId'),
  validateBody(updateBaselineItemSchema),
  controller.updateBaselineItem,
);

router.delete(
  '/baseline-items/:itemId',
  authenticate,
  validateObjectId('itemId'),
  controller.deleteBaselineItem,
);

export default router;
