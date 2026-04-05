import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { mapChainProduct } from '../mappers/chain-product.mapper';
import type { ChainProduct, ChainId, UpsertChainProductData } from '../models/chain-product.model';

// Maximum candidates returned for name matching — keeps in-memory scoring fast
const NAME_CANDIDATE_LIMIT = 30;

export class ChainProductRepository {
  /**
   * Insert or update a product identified by { chainId, externalId }.
   * Also marks the product active and updates lastSeenAt.
   * Safe for concurrent import jobs — uses findOneAndUpdate with upsert.
   */
  async upsertProduct(data: UpsertChainProductData): Promise<ChainProduct> {
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

    if (!doc) throw new Error('upsertProduct: unexpected null document');
    return mapChainProduct(doc);
  }

  /**
   * Mark all active products for a chain as inactive EXCEPT those in seenExternalIds.
   * Called after an import loop to deactivate products no longer in the latest file.
   * Returns the number of documents actually modified.
   */
  async markInactiveExcept(chainId: ChainId, seenExternalIds: string[]): Promise<number> {
    const result = await ChainProductMongoose.updateMany(
      { chainId, externalId: { $nin: seenExternalIds }, isActive: true },
      { $set: { isActive: false } },
    );
    return result.modifiedCount;
  }

  /**
   * Find active products matching a barcode, optionally restricted to one chain.
   */
  async findByBarcode(barcode: string, chainId?: ChainId): Promise<ChainProduct[]> {
    const filter: Record<string, unknown> = { barcode, isActive: true };
    if (chainId) filter.chainId = chainId;

    const docs = await ChainProductMongoose.find(filter).lean();
    return docs.map(mapChainProduct);
  }

  /**
   * Fetch candidate products for name-based matching.
   * Returns up to NAME_CANDIDATE_LIMIT results; the caller scores and ranks them.
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
   * DEV ONLY — print a quick summary of what is stored for a chain.
   * Call via verifyImport() on the service; never called in production flows.
   */
  async verifyImport(chainId: ChainId): Promise<void> {
    const total = await ChainProductMongoose.countDocuments({ chainId });
    const active = await ChainProductMongoose.countDocuments({ chainId, isActive: true });
    const inactive = total - active;
    const samples = await ChainProductMongoose.find({ chainId }).limit(3).lean();

    console.log(`[VERIFY] chainId=${chainId} total=${total} active=${active} inactive=${inactive}`);
    samples.forEach((s, i) =>
      console.log(
        `[VERIFY] sample[${i}] externalId=${s.externalId} name="${s.originalName}" price=${s.price} isActive=${s.isActive}`,
      ),
    );
  }
}
