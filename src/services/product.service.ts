import { ProductRepository } from '../repositories/product.repository';
import type { ProductSearchResult } from '../repositories/product.repository';

export class ProductService {
  private readonly repo: ProductRepository;

  constructor(repo?: ProductRepository) {
    this.repo = repo ?? new ProductRepository();
  }

  async search(query: string, limit = 15): Promise<ProductSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];
    return this.repo.searchByName(trimmed, limit);
  }
}
