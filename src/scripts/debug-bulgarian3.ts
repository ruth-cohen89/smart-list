import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';
import { ProductGroupRepository } from '../repositories/product-group.repository';

async function main() {
  await connectMongo();

  const groupRepo = new ProductGroupRepository();
  const service = new ProductGroupService(groupRepo);

  const groups = await groupRepo.search('גבינה בולגרית', 1);
  const group = groups[0];
  console.log(`Group: ${group.name}`);
  console.log(`  includeKeywords: [${group.includeKeywords.join(', ')}]`);
  console.log(`  excludeKeywords: [${group.excludeKeywords.join(', ')}]`);
  console.log(`  normalizedKeywords: [${group.normalizedKeywords.join(', ')}]`);

  const result = await service.mapToProducts(group.id);
  console.log(`\nResults:`, JSON.stringify(result.results, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
