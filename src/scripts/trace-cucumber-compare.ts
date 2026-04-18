/**
 * Trace the exact compare flow for מלפפון from the real shopping list.
 * Usage: npx ts-node src/scripts/trace-cucumber-compare.ts [userId]
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import ProductMongoose from '../infrastructure/db/product.mongoose.model';
import { normalizeName } from '../utils/normalize';
import { matchProduceCanonical } from '../data/produce-catalog';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';

async function main() {
  await connectMongo();

  const userIdArg = process.argv[2];

  // Find a user who has מלפפון in their active shopping list
  let targetUserId: string | null = null;
  let targetItem: any = null;

  const ShoppingListMongoose = (await import('../infrastructure/db/shopping-list.mongoose.model')).default;

  if (userIdArg) {
    targetUserId = userIdArg;
  } else {
    // Find any active list with מלפפון
    const lists = await ShoppingListMongoose.find({ status: 'active' }).lean();
    for (const list of lists) {
      const cucumberItem = list.items?.find((i: any) =>
        (i.name ?? '').includes('מלפפון') || (i.rawName ?? '').includes('מלפפון')
      );
      if (cucumberItem) {
        targetUserId = list.userId?.toString() ?? null;
        targetItem = cucumberItem;
        console.log(`Found מלפפון in list of userId=${targetUserId}`);
        break;
      }
    }
  }

  if (!targetUserId) {
    console.log('❌ No active shopping list with מלפפון found. Pass userId as argument.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!targetItem) {
    const list = await ShoppingListMongoose.findOne({ userId: new mongoose.Types.ObjectId(targetUserId), status: 'active' }).lean();
    targetItem = list?.items?.find((i: any) =>
      (i.name ?? '').includes('מלפפון') || (i.rawName ?? '').includes('מלפפון')
    );
  }

  if (!targetItem) {
    console.log(`❌ No מלפפון item in active list for userId=${targetUserId}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('SHOPPING LIST ITEM');
  console.log('═'.repeat(70));
  console.log(`  _id:             ${targetItem._id}`);
  console.log(`  name:            "${targetItem.name}"`);
  console.log(`  rawName:         "${targetItem.rawName ?? '(none)'}"`);
  console.log(`  barcode:         ${targetItem.barcode ?? '(none)'}`);
  console.log(`  productId:       ${targetItem.productId ?? '(none)'}`);
  console.log(`  category:        ${targetItem.category ?? '(none)'}`);
  console.log(`  selectionSource: ${targetItem.selectionSource ?? '(none)'}`);
  console.log(`  matchedProduct:  ${JSON.stringify(targetItem.matchedProduct ?? null)}`);

  const inputName = targetItem.rawName ?? targetItem.name;
  const normalized = normalizeName(inputName);
  console.log(`\n  normalizeName("${inputName}") → "${normalized}"`);

  // Step 1: productId check
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 1: productId match');
  if (targetItem.productId) {
    console.log(`  item has productId=${targetItem.productId} → will try productId route`);
    for (const chainId of SUPPORTED_CHAINS) {
      const matches = await ChainProductMongoose.find({
        chainId,
        productId: new mongoose.Types.ObjectId(targetItem.productId.toString()),
      }).lean();
      console.log(`  chain=${chainId}: ${matches.length} products linked`);
      for (const p of matches) {
        console.log(`    type=${p.productType} "${p.originalName}" price=${p.price}`);
      }
    }
  } else {
    console.log('  item has no productId → skipping productId route');
  }

  // Step 2: barcode check
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 2: barcode match');
  if (targetItem.barcode) {
    console.log(`  item has barcode=${targetItem.barcode} → barcode-only route (no fallback)`);
  } else {
    console.log('  item has no barcode → continuing to produce catalog check');
  }

  // Step 3: produce catalog
  console.log('\n' + '─'.repeat(70));
  console.log('STEP 3: produce catalog match');
  const produceMatch = matchProduceCanonical(normalized);
  if (!produceMatch) {
    console.log(`  ❌ No produce catalog match for "${normalized}" → falls through to name matching`);
  } else {
    console.log(`  ✅ Produce match: canonicalKey="${produceMatch.entry.canonicalKey}"`);
    console.log(`     excludeTokens: [${(produceMatch.entry.excludeTokens ?? []).map(t => `"${t}"`).join(', ')}]`);

    // Find global product
    const globalProd = await ProductMongoose.findOne({ canonicalKey: produceMatch.entry.canonicalKey }).lean();
    if (!globalProd) {
      console.log(`  ❌ No global Product for canonicalKey="${produceMatch.entry.canonicalKey}"`);
    } else {
      console.log(`  Global product: _id=${globalProd._id} type="${globalProd.productType}"`);

      const excludeTokens = produceMatch.entry.excludeTokens ?? [];

      console.log('\n' + '─'.repeat(70));
      console.log('STEP 3a: per-chain produce chain products');
      for (const chainId of SUPPORTED_CHAINS) {
        const linked = await ChainProductMongoose.find({
          chainId,
          productId: globalProd._id,
        }).lean();

        const produce = linked.filter(p => p.productType === 'produce');
        const afterExclude = produce.filter(p => !excludeTokens.some(t => (p.normalizedName ?? '').includes(t)));

        console.log(`\n  chain=${chainId}: linked=${linked.length}  produce=${produce.length}  afterExclude=${afterExclude.length}`);
        for (const p of linked) {
          const isProduceType = p.productType === 'produce';
          const excluded = excludeTokens.some(t => (p.normalizedName ?? '').includes(t));
          const status = !isProduceType ? '✗ wrong type' : excluded ? '✗ excluded' : '✓ match';
          console.log(`    [${status}] type=${p.productType} "${p.originalName}" (norm:"${p.normalizedName}")`);
        }

        if (afterExclude.length > 0) {
          const cheapest = afterExclude.reduce((a, b) => b.price < a.price ? b : a);
          console.log(`  → WOULD MATCH: "${cheapest.originalName}" price=${cheapest.price}`);
        } else {
          console.log(`  → WOULD BE UNMATCHED via produce route`);
        }
      }
    }
  }

  // Step 4: check what matchedProduct resolves to (if any)
  if (targetItem.matchedProduct && targetItem.selectionSource &&
    ['user_selected', 'barcode', 'auto_match'].includes(targetItem.selectionSource)) {
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 4: matchedProduct shortcut');
    console.log(`  selectionSource=${targetItem.selectionSource}`);
    console.log(`  matchedProduct=${JSON.stringify(targetItem.matchedProduct)}`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('ENVIRONMENT CHECK');
  console.log('═'.repeat(70));
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`  MONGO_URI: ${(process.env.MONGO_URI ?? '').replace(/\/\/[^@]+@/, '//***@')}`);
  const db = mongoose.connection;
  console.log(`  Connected DB: ${db.host}:${db.port}/${db.name}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
