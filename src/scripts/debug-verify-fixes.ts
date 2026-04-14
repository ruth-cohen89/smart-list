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

  const testGroups = ['שיבולת שועל', 'לחמניות', 'לימון', 'חמאה', 'יוגורט טבעי'];

  for (const name of testGroups) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Group: ${name}`);
    console.log('='.repeat(60));

    const groups = await groupRepo.search(name, 1);
    if (groups.length === 0) {
      console.log('  NOT FOUND');
      continue;
    }
    const group = groups[0];

    const result = await service.mapToProducts(group.id);

    for (const [chainId, matches] of Object.entries(result.results)) {
      console.log(`\n  ${chainId}:`);
      for (const m of matches) {
        console.log(`    "${m.name}" barcode=${m.barcode} score=${m.score.toFixed(2)} price=${m.price}`);
      }
    }

    if (Object.keys(result.results).length === 0) {
      console.log('  No results');
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
