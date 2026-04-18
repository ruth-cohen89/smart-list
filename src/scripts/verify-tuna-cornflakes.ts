/**
 * Quick verification: new tuna/cornflakes groups return products.
 * Usage: npx ts-node src/scripts/verify-tuna-cornflakes.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';
import { normalizeName } from '../utils/normalize';
import { ProductGroupRepository } from '../repositories/product-group.repository';

async function test(groupName: string) {
  const repo = new ProductGroupRepository();
  const results = await repo.search(normalizeName(groupName), 1);
  const group = results[0] ?? null;
  if (!group) { console.log(`${groupName}: GROUP NOT FOUND IN DB`); return; }
  const svc = new ProductGroupService();
  const result = await svc.mapToProducts(group.id);
  const allMatches = Object.values(result.results).flat() as any[];
  console.log(`\n${groupName}: ${allMatches.length} products`);
  allMatches.slice(0, 4).forEach((m: any) => console.log(`  ✓ "${m.name}" score=${m.score.toFixed(1)}`));
  if (allMatches.length === 0) console.log(`  ⚠ NO PRODUCTS RETURNED`);
}

async function main() {
  await connectMongo();
  await test('טונה בשמן');
  await test('טונה בשמן זית');
  await test('טונה בשמן קנולה');
  await test('טונה במים');
  await test('קורנפלקס');
  await mongoose.disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
