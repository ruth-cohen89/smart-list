/**
 * Verify חזה עוף group returns only real chicken breast products.
 * Usage: npx ts-node src/scripts/verify-chicken-breast.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ProductGroupMongoose from '../infrastructure/db/product-group.mongoose.model';
import { ProductGroupService } from '../services/product-group.service';
import { ProductGroupRepository } from '../repositories/product-group.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';

async function main() {
  await connectMongo();

  const groupRepo = new ProductGroupRepository();
  const variantRepo = new ProductVariantRepository();
  const chainProductRepo = new ChainProductRepository();
  const svc = new ProductGroupService(groupRepo, variantRepo, chainProductRepo);

  const group = await ProductGroupMongoose.findOne({ normalizedName: 'חזה עוף' }).lean();
  if (!group) { console.log('❌ Group not found'); process.exit(1); }

  console.log(`Group: "${group.name}"`);
  console.log(`includeKeywords: [${group.includeKeywords?.join(', ')}]`);
  console.log(`excludeKeywords: [${group.excludeKeywords?.join(', ')}]`);
  console.log(`aliases: [${group.aliases?.join(', ')}]`);

  const printResults = (label: string, result: { results: Record<string, any[]> }) => {
    console.log(`\n── ${label} ──`);
    for (const [chainId, matches] of Object.entries(result.results)) {
      for (const r of matches) console.log(`  [${chainId}] "${r.name}" score=${r.score?.toFixed(2)}`);
    }
    const total = Object.values(result.results).reduce((s, a) => s + a.length, 0);
    console.log(`Total: ${total}`);
  };

  const baseResult = await svc.mapToProducts(group._id.toString());
  printResults('Base group mapping', baseResult);

  const ProductVariantMongoose = (await import('../infrastructure/db/product-variant.mongoose.model')).default;
  const freshVariant = await ProductVariantMongoose.findOne({ groupId: group._id, name: 'טרי' }).lean();
  const frozenVariant = await ProductVariantMongoose.findOne({ groupId: group._id, name: 'קפוא' }).lean();

  if (freshVariant) {
    const r = await svc.mapToProducts(group._id.toString(), freshVariant._id.toString());
    printResults('Variant: טרי', r);
  }
  if (frozenVariant) {
    const r = await svc.mapToProducts(group._id.toString(), frozenVariant._id.toString());
    printResults('Variant: קפוא', r);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
