import api from './api';
import type {
  ConsumptionProfile,
  CreateBaselineItemPayload,
  UpsertConsumptionProfilePayload,
} from '../types';

export const consumptionProfileService = {
  getProfile: () => api.get<ConsumptionProfile>('/consumption-profile').then((r) => r.data),

  upsertFromQuestionnaire: (payload: UpsertConsumptionProfilePayload) =>
    api.put<ConsumptionProfile>('/consumption-profile', payload).then((r) => r.data),

  addBaselineItem: (payload: CreateBaselineItemPayload) =>
    api
      .post<ConsumptionProfile>('/consumption-profile/baseline-items', payload)
      .then((r) => r.data),

  deleteBaselineItem: (itemId: string) =>
    api
      .delete<ConsumptionProfile>(`/consumption-profile/baseline-items/${itemId}`)
      .then((r) => r.data),
};
