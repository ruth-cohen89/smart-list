import api from './api';
import type { ProductSearchResponse } from '../types';

export const productService = {
  search: (q: string) =>
    api.get<ProductSearchResponse>('/products/search', { params: { q } }).then((r) => r.data),
};
