/**
 * Targeted backfill: link shufersal fresh cucumber chain products to the
 * cucumber produce global product.
 *
 * Context: shufersal cucumbers all have barcodes → backfill typed them
 * as "packaged" and never ran produce catalog logic. matchByProduce filters
 * by productType=produce, so shufersal always returns unmatched for מלפפון.
 *
 * This script re-links only unambiguous fresh cucumber products:
 *   - name contains מלפפון
 *   - does NOT contain pickled/preserved tokens
 *   - does NOT contain non-food tokens
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-cucumber-shufersal.ts --dry-run
 *   npx ts-node src/scripts/backfill-cucumber-shufersal.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { ProductRepository } from '../repositories/product.repository';
import { matchProduceCanonical } from '../data/produce-catalog';

const DRY_RUN = process.argv.includes('--dry-run');

// Non-food indicators: personal care, seeds, etc.
const NON_FOOD_TOKENS = ['דאב', 'מסכת', 'מסכה', 'שמפו', 'מרכך', 'רחצה', 'דאודורנט', 'סבון', 'תרחיץ', 'זרעי'];

async function main() {
  console.log(`[BACKFILL-CUCUMBER] mode=${DRY_RUN ? 'DRY_RUN' : 'LIVE'}`);
  await connectMongo();

  const productRepo = new ProductRepository();

  // Get the produce catalog entry for cucumber (includes excludeTokens)
  const { entry: cucumberEntry } = matchProduceCanonical('מלפפון')!;
  const excludeTokens = cucumberEntry.excludeTokens ?? [];
  console.log(`[BACKFILL-CUCUMBER] excludeTokens: [${excludeTokens.map(t => `"${t}"`).join(', ')}]`);

  // Find or create the cucumber global produce product
  const cucumberProduct = await productRepo.findOrCreateByCanonicalKey({
    canonicalKey: cucumberEntry.canonicalKey,
    canonicalName: cucumberEntry.canonicalName,
    normalizedName: cucumberEntry.normalizedName,
    category: cucumberEntry.category,
    unitType: cucumberEntry.unitType,
    isWeighted: cucumberEntry.isWeighted,
  });
  console.log(`[BACKFILL-CUCUMBER] cucumberProductId=${cucumberProduct.id} name="${cucumberProduct.canonicalName}"`);

  // Fetch all shufersal chain products with מלפפון in name
  const candidates = await ChainProductMongoose.find({
    chainId: 'shufersal',
    normalizedName: { $regex: 'מלפפון' },
    isActive: true,
  }).lean();

  console.log(`[BACKFILL-CUCUMBER] shufersal candidates: ${candidates.length}`);

  const toLink: typeof candidates = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const p of candidates) {
    const norm = p.normalizedName ?? '';

    const pickledToken = excludeTokens.find(t => norm.includes(t));
    if (pickledToken) {
      skipped.push({ name: p.originalName, reason: `pickled/preserved token: "${pickledToken}"` });
      continue;
    }

    const nonFoodToken = NON_FOOD_TOKENS.find(t => norm.includes(t));
    if (nonFoodToken) {
      skipped.push({ name: p.originalName, reason: `non-food token: "${nonFoodToken}"` });
      continue;
    }

    // Already linked to cucumber global product — skip
    if (p.productId?.toString() === cucumberProduct.id) {
      skipped.push({ name: p.originalName, reason: 'already linked to cucumber product' });
      continue;
    }

    toLink.push(p);
  }

  console.log(`\n[BACKFILL-CUCUMBER] Will link: ${toLink.length}`);
  for (const p of toLink) {
    console.log(`  ✓ "${p.originalName}" (was productId=${p.productId ?? 'none'} type=${p.productType ?? 'none'})`);
  }

  console.log(`\n[BACKFILL-CUCUMBER] Skipped: ${skipped.length}`);
  for (const s of skipped) {
    console.log(`  ✗ "${s.name}" → ${s.reason}`);
  }

  if (toLink.length === 0) {
    console.log('\n[BACKFILL-CUCUMBER] Nothing to update.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!DRY_RUN) {
    const ids = toLink.map(p => p._id as mongoose.Types.ObjectId);
    const result = await ChainProductMongoose.updateMany(
      { _id: { $in: ids } },
      { $set: { productId: new mongoose.Types.ObjectId(cucumberProduct.id), productType: 'produce' } },
    );
    console.log(`\n[BACKFILL-CUCUMBER] Updated ${result.modifiedCount} chain products → productId=${cucumberProduct.id} productType=produce`);
  } else {
    console.log('\n[BACKFILL-CUCUMBER] Dry run — no changes written.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
