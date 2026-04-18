/**
 * Query real chainProducts for סודה, אבקת אפייה, טישו נשלף
 * Usage: npx ts-node src/scripts/debug-soda-baking-tissue.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function queryPattern(label: string, regex: string, limit = 80) {
  const docs = await ChainProductMongoose.find({
    isActive: true,
    normalizedName: { $regex: regex, $options: 'i' },
  }).limit(limit).lean();

  console.log(`\n── ${label} (${docs.length} results) ──`);
  const seen = new Set<string>();
  for (const d of docs) {
    const key = `[${d.chainId}] ${d.originalName}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  ${key}`);
    }
  }
}

async function main() {
  await connectMongo();

  // ── סודה / מים מוגזים ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('סודה / מים מוגזים (SODA WATER)');
  console.log('═'.repeat(70));
  await queryPattern('All סודה', 'סודה');
  await queryPattern('מוגז alone', 'מוגז');
  await queryPattern('מי סודה', '(?=.*מי)(?=.*סודה)');
  await queryPattern('מים מוגזים', '(?=.*מים)(?=.*מוגז)');
  await queryPattern('sparkling water brands', 'נביעות|מעיין|שטראוס');

  // ── אבקת אפייה ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('אבקת אפייה (BAKING POWDER)');
  console.log('═'.repeat(70));
  await queryPattern('All אבקת אפייה', '(?=.*אבקת)(?=.*אפייה)');
  await queryPattern('אפייה alone', 'אפיי');
  await queryPattern('אבקת alone', 'אבקת');
  await queryPattern('baking powder brands', 'רויאל|royal|clabber|שמרית');
  await queryPattern('אבקה + תפוח (baking soda)', '(?=.*אבקה)(?=.*תפוח)');

  // ── נייר / טישו נשלף ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('נייר / טישו נשלף (FACIAL TISSUES)');
  console.log('═'.repeat(70));
  await queryPattern('All נשלף', 'נשלף');
  await queryPattern('All טישו', 'טישו');
  await queryPattern('tissue box', '(?=.*טישו|tissue)(?=.*קופסה|קופסת|בוקס|box)');
  await queryPattern('נייר פנים / נייר אף', '(?=.*נייר)(?=.*פנים|אף|רך)');
  await queryPattern('מגבת נייר', '(?=.*מגבת)(?=.*נייר)');
  await queryPattern('Kleenex', 'קלינקס|kleenex');
  await queryPattern('סנו tissue', 'סנו.*(?:נשלף|טישו)|(?:נשלף|טישו).*סנו');
  await queryPattern('מגבונ נשלף', '(?=.*מגבונ|מפיות)(?=.*נשלף)');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
