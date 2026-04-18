/**
 * Verify cucumber (מלפפון) matching end-to-end.
 * Usage: npx ts-node src/scripts/verify-cucumber.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ProductMongoose from '../infrastructure/db/product.mongoose.model';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import { matchProduceCanonical } from '../data/produce-catalog';
import { normalizeName } from '../utils/normalize';

const ITEM_NAME = 'מלפפון';

async function main() {
  await connectMongo();

  const normalized = normalizeName(ITEM_NAME);
  console.log(`\nInput: "${ITEM_NAME}"  normalized: "${normalized}"`);

  // 1. Does produce catalog match?
  const produceMatch = matchProduceCanonical(normalized);
  if (!produceMatch) {
    console.log('❌ No produce catalog match — item would fall through to name matching');
    process.exit(1);
  }
  console.log(`✅ Produce catalog match: canonicalKey="${produceMatch.entry.canonicalKey}" via alias="${produceMatch.matchedAlias}"`);
  console.log(`   excludeTokens: [${(produceMatch.entry.excludeTokens ?? []).map(t => `"${t}"`).join(', ')}]`);

  // 2. Find global product
  const product = await ProductMongoose.findOne({ canonicalKey: produceMatch.entry.canonicalKey }).lean();
  if (!product) {
    console.log(`\n❌ No global Product doc found for canonicalKey="${produceMatch.entry.canonicalKey}"`);
    console.log('   → matchByProduce will call findOrCreate, then findByProductId — likely 0 results (no backfill yet)');
  } else {
    console.log(`\n✅ Global product: _id=${product._id}  name="${product.canonicalName}"  type="${product.productType}"`);
  }

  const productId = product?._id;
  const excludeTokens = produceMatch.entry.excludeTokens ?? [];

  // 3. Per-chain analysis
  console.log('\n' + '═'.repeat(70));
  console.log('CHAIN PRODUCT ANALYSIS');
  console.log('═'.repeat(70));

  for (const chainId of SUPPORTED_CHAINS) {
    console.log(`\n── ${chainId} ──`);

    // All chain products linked by productId
    const byProductId = productId
      ? await ChainProductMongoose.find({ chainId, productId }).lean()
      : [];

    // All chain products with מלפפון in name
    const byName = await ChainProductMongoose.find({
      chainId,
      normalizedName: { $regex: 'מלפפון' },
      isActive: true,
    }).lean();

    console.log(`  Products linked by productId: ${byProductId.length}`);
    for (const p of byProductId) {
      const filtered = excludeTokens.some(t => (p.normalizedName ?? '').includes(t));
      console.log(`    [${filtered ? '✗ EXCLUDED' : '✓ KEPT'}] type=${p.productType ?? 'none'} "${p.originalName}" (norm: "${p.normalizedName}")`);
    }

    const produce = byProductId.filter(p => p.productType === 'produce');
    const afterExclude = produce.filter(p => !excludeTokens.some(t => (p.normalizedName ?? '').includes(t)));

    if (afterExclude.length > 0) {
      const cheapest = afterExclude.reduce((a, b) => b.price < a.price ? b : a);
      console.log(`  → MATCH: "${cheapest.originalName}" price=${cheapest.price}`);
    } else if (byProductId.length > 0) {
      console.log(`  → UNMATCHED (all linked products filtered out or wrong type)`);
    } else {
      console.log(`  → UNMATCHED (no products linked by productId)`);

      // Show what exists in chain with מלפפון in name
      if (byName.length > 0) {
        console.log(`  Active chain products containing "מלפפון" (not linked):`);
        for (const p of byName.slice(0, 10)) {
          console.log(`    type=${p.productType ?? 'none'} hasProductId=${!!p.productId} "${p.originalName}"`);
        }
      } else {
        console.log(`  No active chain products found with "מלפפון" in name`);
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
