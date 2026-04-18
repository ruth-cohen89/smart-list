/**
 * Verify soda, cola, and coffee groups via the actual service.
 * Usage: npx ts-node src/scripts/verify-drinks-groups.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';
import { ProductGroupRepository } from '../repositories/product-group.repository';

async function testSearch(_label: string, query: string) {
  const svc = new ProductGroupService();
  const groups = await svc.search(query, 5);
  console.log(`\n── search("${query}") → ${groups.length} groups ──`);
  for (const g of groups) {
    console.log(`  "${g.name}" (id=${g.id})`);
  }
  return groups;
}

async function testMapToProducts(_label: string, groupName: string) {
  const repo = new ProductGroupRepository();
  const all = await repo.findAll();
  const group = all.find(g => g.name === groupName);
  if (!group) {
    console.log(`\n!! Group not found: "${groupName}"`);
    return;
  }

  const svc = new ProductGroupService();
  const result = await svc.mapToProducts(group.id);
  console.log(`\n── mapToProducts("${groupName}") ──`);
  for (const [chainId, matches] of Object.entries(result.results)) {
    console.log(`  [${chainId}]:`);
    for (const m of matches) {
      console.log(`    "${m.name}" score=${m.score.toFixed(2)} price=${m.price}`);
    }
  }
  const totalResults = Object.values(result.results).reduce((sum, arr) => sum + arr.length, 0);
  if (totalResults === 0) console.log('  *** NO PRODUCTS RETURNED ***');
}

async function main() {
  await connectMongo();

  // Test searches
  await testSearch('cola', 'קולה');
  await testSearch('soda', 'סודה');
  await testSearch('juice', 'מיצים');
  await testSearch('coffee beans', 'קפה גרגירים');

  // Test existing groups
  await testMapToProducts('cola', 'קולה');
  await testMapToProducts('cola zero', 'קולה זירו');
  await testMapToProducts('soda', 'סודה / מים מוגזים');
  await testMapToProducts('juices', 'מיצים');
  await testMapToProducts('coffee instant', 'קפה נמס');
  await testMapToProducts('coffee ground', 'קפה קלוי וטחון');
  await testMapToProducts('coffee turkish', 'קפה טורקי');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
