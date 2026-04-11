import api from './api';
import type {
  ProductGroupSearchResponse,
  ProductVariantsResponse,
  GroupMappingResult,
} from '../types';

export const productGroupService = {
  searchGroups: (q: string) =>
    api
      .get<ProductGroupSearchResponse>('/product-groups/search', { params: { q } })
      .then((r) => r.data),

  getVariants: (groupId: string) =>
    api
      .get<ProductVariantsResponse>(`/product-groups/${groupId}/variants`)
      .then((r) => r.data),

  mapGroup: (groupId: string, variantId?: string) =>
    api
      .get<GroupMappingResult>(`/product-groups/${groupId}/map`, {
        params: variantId ? { variantId } : {},
      })
      .then((r) => r.data),
};
