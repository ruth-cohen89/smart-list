/**
 * Backfill script: resolves existing chainProducts to global Products.
 *
 * For each active chainProduct that has no productId:
 *   1. If it has a barcode → find-or-create a packaged Product
 *   2. If no barcode → try produce catalog match → find-or-create a produce Product
 *   3. If no match → skip (leave unresolved)
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-product-ids.ts
 *   npx ts-node src/scripts/backfill-product-ids.ts --dry-run
 *   npx ts-node src/scripts/backfill-product-ids.ts --chain shufersal
 *   npx ts-node src/scripts/backfill-product-ids.ts --batch-size 500
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { ProductRepository } from '../repositories/product.repository';
import { matchProduceCanonical } from '../data/produce-catalog';
import { normalizeName } from '../utils/normalize';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';
import type { ProductType } from '../models/product.model';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const chainArg = args.find((_, i) => args[i - 1] === '--chain');
const batchSizeArg = args.find((_, i) => args[i - 1] === '--batch-size');
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg, 10) : 200;
const TARGET_CHAINS: ChainId[] = chainArg
  ? [chainArg as ChainId]
  : [...SUPPORTED_CHAINS];

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface BackfillStats {
  total: number;
  resolved: number;
  packaged: number;
  produce: number;
  unresolved: number;
  errors: number;
}

function emptyStats(): BackfillStats {
  return { total: 0, resolved: 0, packaged: 0, produce: 0, unresolved: 0, errors: 0 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function backfill() {
  console.log(`[BACKFILL] mode=${DRY_RUN ? 'DRY_RUN' : 'LIVE'} chains=${TARGET_CHAINS.join(',')} batchSize=${BATCH_SIZE}`);

  await connectMongo();

  const productRepo = new ProductRepository();
  const globalStats = emptyStats();

  for (const chainId of TARGET_CHAINS) {
    if (!SUPPORTED_CHAINS.includes(chainId)) {
      console.error(`[BACKFILL] unknown chain: ${chainId}`);
      continue;
    }

    const chainStats = await backfillChain(chainId, productRepo);

    globalStats.total += chainStats.total;
    globalStats.resolved += chainStats.resolved;
    globalStats.packaged += chainStats.packaged;
    globalStats.produce += chainStats.produce;
    globalStats.unresolved += chainStats.unresolved;
    globalStats.errors += chainStats.errors;
  }

  console.log(`[BACKFILL] === DONE ===`);
  console.log(`[BACKFILL] total=${globalStats.total} resolved=${globalStats.resolved} (packaged=${globalStats.packaged} produce=${globalStats.produce}) unresolved=${globalStats.unresolved} errors=${globalStats.errors}`);

  await mongoose.disconnect();
}

async function backfillChain(
  chainId: ChainId,
  productRepo: ProductRepository,
): Promise<BackfillStats> {
  const stats = emptyStats();

  const totalCount = await ChainProductMongoose.countDocuments({
    chainId,
    isActive: true,
    productId: { $exists: false },
  });

  console.log(`[BACKFILL] chain=${chainId} unresolved=${totalCount}`);
  stats.total = totalCount;

  if (totalCount === 0) return stats;

  let processed = 0;
  let lastId: mongoose.Types.ObjectId | undefined;

  while (processed < totalCount) {
    const filter: Record<string, unknown> = {
      chainId,
      isActive: true,
      productId: { $exists: false },
    };
    if (lastId) filter._id = { $gt: lastId };

    const batch = await ChainProductMongoose.find(filter)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    const bulkOps: Array<{
      updateOne: {
        filter: { _id: mongoose.Types.ObjectId };
        update: { $set: { productId: mongoose.Types.ObjectId; productType: ProductType } };
      };
    }> = [];

    for (const doc of batch) {
      try {
        const normalizedName = doc.normalizedName || normalizeName(doc.originalName);

        // STEP 1: Barcode → packaged
        if (doc.barcode) {
          const product = await productRepo.findOrCreateByBarcode({
            barcode: doc.barcode,
            canonicalName: doc.originalName,
            normalizedName,
          });
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as mongoose.Types.ObjectId },
              update: {
                $set: {
                  productId: new mongoose.Types.ObjectId(product.id),
                  productType: 'packaged',
                },
              },
            },
          });
          stats.packaged++;
          stats.resolved++;
          continue;
        }

        // STEP 2: No barcode → try produce match
        const produceMatch = matchProduceCanonical(normalizedName);
        if (produceMatch) {
          const entry = produceMatch.entry;
          const product = await productRepo.findOrCreateByCanonicalKey({
            canonicalKey: entry.canonicalKey,
            canonicalName: entry.canonicalName,
            normalizedName: entry.normalizedName,
            category: entry.category,
            unitType: entry.unitType,
            isWeighted: entry.isWeighted,
          });
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id as mongoose.Types.ObjectId },
              update: {
                $set: {
                  productId: new mongoose.Types.ObjectId(product.id),
                  productType: 'produce',
                },
              },
            },
          });
          stats.produce++;
          stats.resolved++;
          continue;
        }

        // STEP 3: Unresolved
        stats.unresolved++;
      } catch (err) {
        stats.errors++;
        console.error(
          `[BACKFILL] error chain=${chainId} externalId=${doc.externalId} err=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Write batch
    if (!DRY_RUN && bulkOps.length > 0) {
      await ChainProductMongoose.bulkWrite(bulkOps, { ordered: false });
    }

    processed += batch.length;
    lastId = batch[batch.length - 1]._id as mongoose.Types.ObjectId;

    console.log(
      `[BACKFILL] chain=${chainId} progress=${processed}/${totalCount} batch_resolved=${bulkOps.length} batch_unresolved=${batch.length - bulkOps.length}`,
    );
  }

  console.log(
    `[BACKFILL] chain=${chainId} done resolved=${stats.resolved} (packaged=${stats.packaged} produce=${stats.produce}) unresolved=${stats.unresolved} errors=${stats.errors}`,
  );

  return stats;
}

backfill().catch((err) => {
  console.error('[BACKFILL] fatal error:', err);
  process.exit(1);
});
