import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { normalizeForMatching, tokenize } from '../utils/normalize';

async function main() {
  await connectMongo();

  // Check what "חלה" matches in DB now with boundary-aware matching
  const candidates = await ChainProductMongoose.find({
    chainId: 'rami-levy',
    isActive: true,
    normalizedName: { $regex: 'חלה', $options: 'i' },
  }).limit(50).lean();

  console.log(`DB candidates containing "חלה": ${candidates.length}`);

  // Simulate the new substringMatch for include token "חלה"
  const token = 'חלה';
  let passed = 0;
  let blocked = 0;

  for (const cp of candidates) {
    const normalized = normalizeForMatching(cp.originalName as string);
    // Short token (3 chars): require word boundary
    const re = new RegExp(`(?:^|\\s)${token}`);
    const matches = re.test(normalized);

    if (matches) {
      passed++;
      if (passed <= 5) console.log(`  ✅ PASS: "${cp.originalName}" → normalized: "${normalized}"`);
    } else {
      blocked++;
      if (blocked <= 5) console.log(`  ❌ BLOCKED: "${cp.originalName}" → normalized: "${normalized}"`);
    }
  }

  console.log(`\nPassed: ${passed}, Blocked: ${blocked}`);

  // Also check: does the group's excludeKeywords block everything?
  const excludeKW = ['לחם', 'פיתה', 'טורטיה'];
  console.log(`\nGroup excludeKeywords: [${excludeKW.join(', ')}]`);

  let excludedCount = 0;
  for (const cp of candidates) {
    const normalized = normalizeForMatching(cp.originalName as string);
    const tokens = new Set(tokenize(normalized));
    const re = new RegExp(`(?:^|\\s)${token}`);
    if (!re.test(normalized)) continue; // already blocked

    let excluded = false;
    for (const ex of excludeKW) {
      if (tokens.has(ex) || normalized.includes(ex)) {
        excluded = true;
        break;
      }
    }
    if (excluded) {
      excludedCount++;
      if (excludedCount <= 3) console.log(`  Excluded by keywords: "${cp.originalName}"`);
    }
  }
  console.log(`Of the ${passed} that pass substring, ${excludedCount} are then excluded by keywords`);
  console.log(`Final count: ${passed - excludedCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
