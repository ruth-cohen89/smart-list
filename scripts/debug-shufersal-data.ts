// Usage: npx ts-node --transpile-only scripts/debug-shufersal-data.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import mongoose from 'mongoose';
import { normalizeName } from '../src/utils/normalize';
import { matchProduceCanonical } from '../src/data/produce-catalog';
import ChainProductMongoose from '../src/infrastructure/db/chain-product.mongoose.model';
import { ProductRepository } from '../src/repositories/product.repository';

// Items that return "not found" in Shufersal after the latest fixes
const CASES: Array<{ label: string; itemName: string; searchTerms: string[] }> = [
  {
    label: 'תפוח אדמה',
    itemName: 'תפוח אדמה',
    searchTerms: ['תפוח אדמה', 'תפוחי אדמה', 'תפוד'],
  },
  {
    label: 'בצל לבן',
    itemName: 'בצל',
    searchTerms: ['בצל'],
  },
  {
    label: 'בצל אדום',
    itemName: 'בצל אדום',
    searchTerms: ['בצל אדום', 'בצל סגול'],
  },
  {
    label: 'חציל',
    itemName: 'חציל',
    searchTerms: ['חציל', 'חצילים'],
  },
  {
    label: 'פלפל חריף',
    itemName: 'פלפל חריף',
    searchTerms: ['פלפל חריף', 'צ\'ילי'],
  },
];

const CHAINS = ['shufersal', 'rami-levy'] as const;

function sep(label: string) {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${label}`);
  console.log('═'.repeat(80));
}

function hr(label: string) {
  console.log(`\n  ── ${label} ${'─'.repeat(Math.max(0, 74 - label.length))}`);
}

async function findByAliasContains(
  chainId: string,
  terms: string[],
): Promise<any[]> {
  const patterns = terms.map(
    (t) => `(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`,
  );
  return ChainProductMongoose.find({
    chainId,
    normalizedName: { $regex: patterns.join('|'), $options: 'i' },
  })
    .limit(30)
    .lean();
}

async function findByAliasStart(chainId: string, terms: string[]): Promise<any[]> {
  const patterns = terms.map(
    (t) => `^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`,
  );
  return ChainProductMongoose.find({
    chainId,
    normalizedName: { $regex: patterns.join('|'), $options: 'i' },
  })
    .limit(30)
    .lean();
}

function fmt(doc: any): string {
  return (
    `"${doc.originalName}"` +
    `  norm="${doc.normalizedName}"` +
    `  productId=${doc.productId?.toString() ?? '—'}` +
    `  isActive=${doc.isActive}` +
    `  productType=${doc.productType ?? '—'}` +
    `  weighted=${doc.isWeighted ?? '—'}` +
    `  price=${doc.price}`
  );
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);
  const prodRepo = new ProductRepository();

  for (const { label, itemName, searchTerms } of CASES) {
    const normalized = normalizeName(itemName);
    sep(`ITEM: "${label}"  →  normalized: "${normalized}"`);

    // Catalog resolution
    const pm = matchProduceCanonical(normalized);
    console.log(
      pm
        ? `  [CATALOG] ✓ canonicalKey="${pm.entry.canonicalKey}"  aliases=[${pm.entry.normalizedAliases.join(', ')}]`
        : `  [CATALOG] ✗ NOT MATCHED`,
    );

    // Global product
    if (pm) {
      const gp = await prodRepo.findByCanonicalKey(pm.entry.canonicalKey);
      console.log(
        gp
          ? `  [GLOBAL]  id=${gp.id}  type=${gp.productType}`
          : `  [GLOBAL]  ⚠ NOT IN DB`,
      );
    }

    for (const chain of CHAINS) {
      hr(`${chain}`);

      // 1. Alias-start rows (strictest — what Source 1 would see after alias anchor)
      const startRows = await findByAliasStart(chain, searchTerms);
      console.log(`  alias-START rows: ${startRows.length}`);
      for (const d of startRows) console.log(`    ${fmt(d)}`);

      // 2. Alias-contains rows (what findByProduceAliases sees)
      const containsRows = await findByAliasContains(chain, searchTerms);
      const extraContains = containsRows.filter(
        (d) => !startRows.some((s) => s._id.toString() === d._id.toString()),
      );
      console.log(`  alias-CONTAINS (extra beyond alias-start): ${extraContains.length}`);
      for (const d of extraContains) console.log(`    ${fmt(d)}`);

      // 3. Inactive rows — same search but isActive=false
      const inactiveRows = await ChainProductMongoose.find({
        chainId: chain,
        isActive: false,
        normalizedName: {
          $regex: searchTerms
            .map((t) => `(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
            .join('|'),
          $options: 'i',
        },
      })
        .limit(10)
        .lean();
      console.log(`  INACTIVE rows matching alias: ${inactiveRows.length}`);
      for (const d of inactiveRows) console.log(`    ${fmt(d)}`);

      // 4. Summary for this chain
      const withProductId = startRows.filter((d) => d.productId);
      const withoutProductId = startRows.filter((d) => !d.productId);
      console.log(
        `  → alias-start: ${startRows.length} total | ${withProductId.length} linked (productId) | ${withoutProductId.length} unlinked`,
      );
    }
  }

  await mongoose.disconnect();
  console.log('\n[DONE]');
}

run().catch(console.error);
