import { AppError } from '../errors/app-error';
import { ConsumptionProfileRepository } from '../repositories/consumption-profile.repository';
import { ShoppingListService } from './shopping-list.service';

import type { ConsumptionProfile } from '../models/consumption-profile.model';
import type {
  CreateBaselineItemInput,
  UpdateBaselineItemInput,
  UpsertConsumptionProfileInput,
} from '../types/consumption-profile';

export class ConsumptionProfileService {
  private readonly repo = new ConsumptionProfileRepository();
  private readonly shoppingListService = new ShoppingListService();

  getOrCreate(userId: string): Promise<ConsumptionProfile> {
    return this.repo.getOrCreate(userId);
  }

  // Saves the questionnaire result and syncs baseline items to the active list.
  async upsertFromQuestionnaire(
    userId: string,
    input: UpsertConsumptionProfileInput,
  ): Promise<ConsumptionProfile> {
    const profile = await this.repo.upsertProfileFromQuestionnaire(userId, input);

    // Keep the user's active shopping list in sync with the updated baseline.
    await this.shoppingListService.syncBaselineToActiveList(userId, profile.baselineItems);

    return profile;
  }

  async addBaselineItem(userId: string, input: CreateBaselineItemInput) {
    const updated = await this.repo.addBaselineItem(userId, input);
    if (!updated) throw new AppError('Item already exists', 400);
    return updated;
  }

  async updateBaselineItem(userId: string, itemId: string, input: UpdateBaselineItemInput) {
    const updated = await this.repo.updateBaselineItem(userId, itemId, input);
    if (!updated) throw new AppError('Baseline item not found or duplicate name', 400);
    return updated;
  }

  async deleteBaselineItem(userId: string, itemId: string): Promise<ConsumptionProfile> {
    const updated = await this.repo.deleteBaselineItem(userId, itemId);
    if (!updated) throw new AppError('Baseline item not found', 404);
    return updated;
  }
}
