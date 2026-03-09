import type { ConsumptionProfile, BaselineItem } from '../models/consumption-profile.model';
import type {
  IConsumptionProfileDocument,
  IBaselineItemDocument,
} from '../infrastructure/db/consumption-profile.mongoose.model';

const mapBaselineItem = (item: IBaselineItemDocument): BaselineItem => ({
  id: String(item._id),

  name: item.name,
  normalizedName: item.normalizedName,

  quantity: item.quantity,
  unit: item.unit,

  intervalDays: item.intervalDays,

  lastPurchasedAt: item.lastPurchasedAt,
  usageScore: item.usageScore ?? 0,
  lastSuggestedAt: item.lastSuggestedAt,

  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const mapConsumptionProfile = (doc: IConsumptionProfileDocument): ConsumptionProfile => ({
  id: String(doc._id),
  userId: String(doc.userId),

  baselineItems: (doc.baselineItems ?? []).map(mapBaselineItem),

  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
