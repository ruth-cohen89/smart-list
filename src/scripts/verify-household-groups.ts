import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';

async function verifyGroup(service: ProductGroupService, groupName: string) {
  const groups = await service.search(groupName);
  const group = groups.find(g => g.name === groupName);
  if (!group) {
    console.log(`\n✗ Group NOT FOUND in search: "${groupName}"`);
    return;
  }
  console.log(`\n✓ Found group: "${group.name}" (id=${group.id})`);
  const result = await service.mapToProducts(group.id);
  const chains = Object.entries(result.results);
  if (chains.length === 0) {
    console.log('  ✗ NO products mapped');
    return;
  }
  for (const [chainId, matches] of chains) {
    console.log(`  [${chainId}]`);
    for (const m of matches) {
      console.log(`    score=${m.score.toFixed(2)} "${m.name}"`);
    }
  }
}

async function main() {
  await connectMongo();
  const service = new ProductGroupService();
  await verifyGroup(service, 'אבקת כביסה');
  await verifyGroup(service, 'סבון ידיים');
  await verifyGroup(service, 'מגבונים לתינוק');
  await verifyGroup(service, 'מגבוני ניקוי');
  await mongoose.disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
