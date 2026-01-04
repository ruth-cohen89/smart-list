import { AppError } from '../errors/app-error';
import { ConsumptionProfileRepository } from '../repositories/consumption-profile.repository';

import type { ConsumptionProfile } from '../models/consumption-profile.model';
import type {
    CreateBaselineItemInput,
    UpdateBaselineItemInput,
    UpsertConsumptionProfileInput,
} from '../types/consumption-profile';


export class ConsumptionProfileService {
    private readonly repo = new ConsumptionProfileRepository();

    getOrCreate(userId: string): Promise<ConsumptionProfile> {
        return this.repo.getOrCreate(userId);
    }

    upsertFromQuestionnaire(userId: string, input: UpsertConsumptionProfileInput): Promise<ConsumptionProfile> {
        return this.repo.upsertProfileFromQuestionnaire(userId, input);
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
