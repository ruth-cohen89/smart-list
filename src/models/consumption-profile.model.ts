export interface BaselineItem {
  id: string;
  name: string;
  normalizedName: string;
  quantity?: number;
  unit?: string;

  intervalDays: number;

  // for MVP
  lastPurchasedAt?: Date;
  usageScore: number;
  lastSuggestedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface ConsumptionProfile {
  id: string;
  userId: string;
  baselineItems: BaselineItem[];
  createdAt: Date;
  updatedAt: Date;
}
