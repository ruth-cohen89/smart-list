import { Types } from 'mongoose';
import ConsumptionProfileMongoose from '../infrastructure/db/consumption-profile.mongoose.model';
import { mapConsumptionProfile } from '../mappers/consumption-profile.mapper';
import { normalizeName } from '../utils/normalize';

import type { ConsumptionProfile } from '../models/consumption-profile.model';
import type {
  CreateBaselineItemInput,
  UpdateBaselineItemInput,
  UpsertConsumptionProfileInput,
} from '../types/consumption-profile';

export class ConsumptionProfileRepository {
  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  async getOrCreate(userId: string): Promise<ConsumptionProfile> {
    const uid = this.toObjectId(userId);

    const doc =
      (await ConsumptionProfileMongoose.findOne({ userId: uid })) ??
      (await ConsumptionProfileMongoose.create({ userId: uid, baselineItems: [] }));

    return mapConsumptionProfile(doc);
  }

  async upsertProfileFromQuestionnaire(
    userId: string,
    input: UpsertConsumptionProfileInput,
  ): Promise<ConsumptionProfile> {
    const uid = this.toObjectId(userId);

    // Normalize and build the baseline array. usageScore starts at 0 for MVP.
    // baselineItems is runtime-guaranteed by Zod superRefine before this is called.
    const baselineItems = input.baselineItems!.map((it) => {
      const name = it.name!; // runtime-validated by Zod superRefine
      return {
        name,
        normalizedName: normalizeName(name),
        quantity: it.quantity,
        unit: it.unit,
        intervalDays: it.intervalDays!,
        usageScore: 0,
        // lastPurchasedAt / lastSuggestedAt left undefined until purchase events
      };
    });

    const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
      { userId: uid },
      {
        $setOnInsert: { userId: uid },
        $set: { baselineItems },
      },
      { new: true, upsert: true },
    );

    return mapConsumptionProfile(updated);
  }

  // Returns null when a baseline item with the same normalizedName already exists.
  async addBaselineItem(
    userId: string,
    input: CreateBaselineItemInput,
  ): Promise<ConsumptionProfile | null> {
    const uid = this.toObjectId(userId);
    const normalized = normalizeName(input.name!);

    const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
      {
        userId: uid,
        // Atomic uniqueness guard: only push when no duplicate exists.
        'baselineItems.normalizedName': { $ne: normalized },
      },
      {
        $setOnInsert: { userId: uid },
        $push: {
          baselineItems: {
            name: input.name!,
            normalizedName: normalized,
            quantity: input.quantity,
            unit: input.unit,
            intervalDays: input.intervalDays!,
            usageScore: 0,
          },
        },
      },
      { new: true, upsert: true },
    );

    return updated ? mapConsumptionProfile(updated) : null;
  }

  // Returns null when the item is not found or when the new name would duplicate
  // another item's normalizedName.
  async updateBaselineItem(
    userId: string,
    itemId: string,
    input: UpdateBaselineItemInput,
  ): Promise<ConsumptionProfile | null> {
    const uid = this.toObjectId(userId);

    if (input.name !== undefined) {
      const normalized = normalizeName(input.name);

      const dup = await ConsumptionProfileMongoose.findOne({
        userId: uid,
        'baselineItems.normalizedName': normalized,
        'baselineItems._id': { $ne: itemId },
      });

      if (dup) return null;
    }

    const setObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      setObj[`baselineItems.$.${k}`] = v;
    }

    if (input.name !== undefined) {
      setObj['baselineItems.$.normalizedName'] = normalizeName(input.name);
    }

    if (Object.keys(setObj).length === 0) {
      const existing = await ConsumptionProfileMongoose.findOne({
        userId: uid,
        'baselineItems._id': itemId,
      });
      return existing ? mapConsumptionProfile(existing) : null;
    }

    const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
      { userId: uid, 'baselineItems._id': itemId },
      { $set: setObj },
      { new: true },
    );

    return updated ? mapConsumptionProfile(updated) : null;
  }

  async deleteBaselineItem(userId: string, itemId: string): Promise<ConsumptionProfile | null> {
    const uid = this.toObjectId(userId);

    const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
      { userId: uid, 'baselineItems._id': itemId },
      { $pull: { baselineItems: { _id: itemId } } },
      { new: true },
    );

    return updated ? mapConsumptionProfile(updated) : null;
  }
}
