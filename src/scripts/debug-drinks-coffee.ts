/**
 * Query real chainProducts for cola, juices, soda, coffee to identify naming patterns.
 * Usage: npx ts-node src/scripts/debug-drinks-coffee.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function queryPattern(label: string, regex: string, limit = 60) {
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

  // ── Cola ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('COLA PRODUCTS');
  console.log('═'.repeat(70));
  await queryPattern('All קולה', 'קולה');
  await queryPattern('קולה זירו', '(?=.*קולה)(?=.*זירו)');
  await queryPattern('קולה דיאט', '(?=.*קולה)(?=.*דיאט)');
  await queryPattern('פפסי', 'פפסי');
  await queryPattern('קוקה קולה (brand)', 'קוקה');

  // ── Juices ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('JUICE PRODUCTS');
  console.log('═'.repeat(70));
  await queryPattern('All מיץ', 'מיץ', 80);
  await queryPattern('מיץ תפוזים', '(?=.*מיץ)(?=.*תפוז)');
  await queryPattern('מיץ ענבים', '(?=.*מיץ)(?=.*ענב)');
  await queryPattern('מיץ תפוחים', '(?=.*מיץ)(?=.*תפוח)');
  await queryPattern('מיץ לימון', '(?=.*מיץ)(?=.*לימון)');
  await queryPattern('מיץ אשכולית', '(?=.*מיץ)(?=.*אשכולית)');
  await queryPattern('משקה פירות', '(?=.*משקה)(?=.*פיר)');

  // ── Soda ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('SODA / SPARKLING WATER PRODUCTS');
  console.log('═'.repeat(70));
  await queryPattern('All סודה', 'סודה');
  await queryPattern('מים מוגזים', 'מוגז');
  await queryPattern('סודה stream / מכשיר', '(?=.*סודה)(?=.*סטרים|מכשיר|גז)');

  // ── Coffee ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('COFFEE PRODUCTS');
  console.log('═'.repeat(70));
  await queryPattern('All קפה', 'קפה', 100);
  await queryPattern('קפה גרגירים (whole bean / ground)', '(?=.*קפה)(?=.*גרגיר)');
  await queryPattern('קפה טחון', '(?=.*קפה)(?=.*טחון)');
  await queryPattern('טסטרס צויס / Folgers style', '(?=.*קפה)(?=.*טסטר|folger|מקסוול)');
  await queryPattern('קפה אספרסו', '(?=.*קפה)(?=.*אספרסו|espresso)');
  await queryPattern('קפסולות קפה', '(?=.*קפ)(?=.*קפסול)');
  await queryPattern('נסקפה / נמס', '(?=.*קפה)(?=.*נמס|נסקפה|nescafe)');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
