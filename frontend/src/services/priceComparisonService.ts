import api from './api';
import type { ComparisonResult } from '../types';

export const priceComparisonService = {
  compareActive: () =>
    api.get<ComparisonResult>('/price-comparison/compare-active').then((r) => r.data),
};
