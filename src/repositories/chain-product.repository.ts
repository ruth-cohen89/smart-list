import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { mapChainProduct } from '../mappers/chain-product.mapper';
import type { ChainProduct, ChainId, UpsertChainProductData } from '../models/chain-product.model';

// Maximum candidates returned for name matching — keeps in-memory scoring fast
const NAME_CANDIDATE_LIMIT = 30;

export class ChainProductRepository {
  private _loggedTarget = false;

  private logWriteTarget() {
    if (this._loggedTarget) return;
    this._loggedTarget = true;
    const col = ChainProductMongoose.collection;
    console.log(`[REPO] Writing to db="${col.dbName}" collection="${col.collectionName}"`);
  }

  /**
   * Insert or update a product identified by { chainId, externalId }.
   * Also marks the product active and updates lastSeenAt.
   * Safe for concurrent import jobs — uses findOneAndUpdate with upsert.
   */
  async upsertProduct(data: UpsertChainProductData): Promise<ChainProduct> {
    this.logWriteTarget();
    const doc = await ChainProductMongoose.findOneAndUpdate(
      { chainId: data.chainId, externalId: data.externalId },
      {
        $set: {
          barcode: data.barcode,
          originalName: data.originalName,
          normalizedName: data.normalizedName,
          price: data.price,
          unit: data.unit,
          quantity: data.quantity,
          isActive: true,
          lastSeenAt: data.lastSeenAt,
        },
      },
      { upsert: true, new: true },
    );

    // findOneAndUpdate with upsert + new:true always returns a document
    if (!doc) throw new Error('upsertProduct: unexpected null document');

    return mapChainProduct(doc);
  }

  /**
   * Find active products matching a barcode, optionally restricted to one chain.
   * Returns all chains that carry this barcode when chainId is omitted —
   * useful if we ever need cross-chain barcode lookup.
   */
  async findByBarcode(barcode: string, chainId?: ChainId): Promise<ChainProduct[]> {
    const filter: Record<string, unknown> = { barcode, isActive: true };
    if (chainId) filter.chainId = chainId;

    const docs = await ChainProductMongoose.find(filter).lean();
    return docs.map(mapChainProduct);
  }

  /**
   * Fetch candidate products for name-based matching.
   * Strategy: search for active products in the given chain whose normalizedName
   * contains the first significant token of the input. Returns up to NAME_CANDIDATE_LIMIT
   * results; the caller scores and ranks them in memory.
   */
  async findCandidatesByName(normalizedName: string, chainId: ChainId): Promise<ChainProduct[]> {
    const firstToken = normalizedName.split(' ').find((t) => t.length >= 2) ?? normalizedName;

    const docs = await ChainProductMongoose.find({
      chainId,
      isActive: true,
      normalizedName: { $regex: firstToken, $options: 'i' },
    })
      .limit(NAME_CANDIDATE_LIMIT)
      .lean();

    return docs.map(mapChainProduct);
  }

  /**
   * Mark products inactive when an import job no longer sees them.
   * Products are never hard-deleted — they stay in the collection with isActive=false
   * so historical data is preserved and they can be reactivated if they reappear.
   */
  async countByChain(chainId: ChainId): Promise<number> {
    return ChainProductMongoose.countDocuments({ chainId });
  }

  async markInactiveByExternalIds(chainId: ChainId, externalIds: string[]): Promise<void> {
    if (externalIds.length === 0) return;

    await ChainProductMongoose.updateMany(
      { chainId, externalId: { $in: externalIds }, isActive: true },
      { $set: { isActive: false } },
    );
  }
}
