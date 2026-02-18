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

<<<<<<< HEAD
    // normalize + build array (usageScore מתחיל מ-0 ב-POC/MVP)
    const baselineItems = input.baselineItems.map((it) => ({
      name: it.name,
      normalizedName: normalizeName(it.name),
      quantity: it.quantity,
      unit: it.unit,
      intervalDays: it.intervalDays,
      usageScore: 0,
      // lastPurchasedAt/lastSuggestedAt נשארים undefined
    }));

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

  // returns null if duplicate normalizedName already exists
  async addBaselineItem(
    userId: string,
    input: CreateBaselineItemInput,
  ): Promise<ConsumptionProfile | null> {
    const uid = this.toObjectId(userId);
    const normalized = normalizeName(input.name);

    const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
      {
        userId: uid,
        // ✅ atomic uniqueness guard (safe)
        'baselineItems.normalizedName': { $ne: normalized },
      },
      {
        $setOnInsert: { userId: uid },
        $push: {
          baselineItems: {
            name: input.name,
            normalizedName: normalized,
            quantity: input.quantity,
            unit: input.unit,
            intervalDays: input.intervalDays,
            usageScore: 0,
          },
        },
      },
      { new: true, upsert: true },
    );
=======
        const baselineItems = input.baselineItems!.map((it) => {
            const name = it.name!;

            return {
                name,
                normalizedName: normalizeName(name),
                quantity: it.quantity,
                unit: it.unit,
                intervalDays: it.intervalDays,
                usageScore: 0,
            };
        });
>>>>>>> 0d4bcf89752779e5dec6f25478e0cc42f82c0b51

    return updated ? mapConsumptionProfile(updated) : null;
  }

  // returns null if not found OR duplicate name (when updating name)
  async updateBaselineItem(
    userId: string,
    itemId: string,
    input: UpdateBaselineItemInput,
  ): Promise<ConsumptionProfile | null> {
    const uid = this.toObjectId(userId);

    // ✅ prevent duplicate normalizedName when renaming
    if (input.name !== undefined) {
      const normalized = normalizeName(input.name);

      const dup = await ConsumptionProfileMongoose.findOne({
        userId: uid,
        'baselineItems.normalizedName': normalized,
        'baselineItems._id': { $ne: itemId },
      });

      if (dup) return null;
    }

<<<<<<< HEAD
    const setObj: Record<string, any> = {};
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
=======
    async addBaselineItem(userId: string, input: CreateBaselineItemInput) {
        const uid = this.toObjectId(userId);

        await ConsumptionProfileMongoose.updateOne(
            { userId: uid },
            { $setOnInsert: { userId: uid } },
            { upsert: true }
        );

        const name = input.name!;
        const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ');

        const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
            {
                userId: uid,
                baselineItems: { $not: { $elemMatch: { normalizedName } } },
            },
            {
                $push: {
                    baselineItems: {
                        name,
                        normalizedName,
                        quantity: input.quantity,
                        unit: input.unit,
                        intervalDays: input.intervalDays,
                        usageScore: 0,
                    },
                },
            },
            { new: true } // ✅ בלי upsert
        );

        if (!updated) return null; // כפול / לא נמצא
        return mapConsumptionProfile(updated);
    }

    async updateBaselineItem(
        userId: string,
        itemId: string,
        input: UpdateBaselineItemInput
    ): Promise<ConsumptionProfile | null> {
        const uid = this.toObjectId(userId);
        const itemObjectId = this.toObjectId(itemId);

        if (input.name !== undefined) {
            const normalized = normalizeName(input.name);

            const dup = await ConsumptionProfileMongoose.findOne({
                userId: uid,
                'baselineItems.normalizedName': normalized,
                'baselineItems._id': { $ne: itemObjectId },
            });

            if (dup) return null;
        }

        const setObj: Record<string, any> = {};
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
                'baselineItems._id': itemObjectId,
            });
            return existing ? mapConsumptionProfile(existing) : null;
        }

        const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
            { userId: uid, 'baselineItems._id': itemObjectId },
            { $set: setObj },
            { new: true }
        );

        return updated ? mapConsumptionProfile(updated) : null;
    }

    async deleteBaselineItem(userId: string, itemId: string): Promise<ConsumptionProfile | null> {
        const uid = this.toObjectId(userId);
        const itemObjectId = this.toObjectId(itemId);

        const updated = await ConsumptionProfileMongoose.findOneAndUpdate(
            { userId: uid, 'baselineItems._id': itemObjectId },
            { $pull: { baselineItems: { _id: itemObjectId } } },
            { new: true }
        );

        return updated ? mapConsumptionProfile(updated) : null;
>>>>>>> 0d4bcf89752779e5dec6f25478e0cc42f82c0b51
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
