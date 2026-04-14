import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupRepository } from '../repositories/product-group.repository';
import { normalizeName } from '../utils/normalize';
import type { ProductGroup } from '../models/product-group.model';

async function main() {
  await connectMongo();

  const repo = new ProductGroupRepository();
  const allGroups = await repo.findAll();

  const buildSearchable = (g: ProductGroup) =>
    [g.normalizedName, ...g.normalizedKeywords, ...g.aliases].join(' ').toLowerCase();

  const queries = ['חלב שקדים', 'קמח חיטה מלא'];

  for (const q of queries) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Query: "${q}"`);

    const normalized = normalizeName(q);
    const tokens = normalized.split(' ').filter((t: string) => t.length >= 2);

    // Compute DF for each token against ALL groups
    for (const token of tokens) {
      let df = 0;
      const matchingGroups: string[] = [];
      for (const g of allGroups) {
        if (buildSearchable(g).includes(token)) {
          df++;
          matchingGroups.push(g.name);
        }
      }
      console.log(`  Token "${token}": DF=${df} → groups: [${matchingGroups.join(', ')}]`);
    }

    // Show candidate scores
    const candidates = await repo.searchByTokens(tokens, 40);
    console.log(`  Candidates (${candidates.length}):`);
    for (const g of candidates) {
      const searchable = buildSearchable(g);
      let score = 0;
      const details: string[] = [];
      for (let i = 0; i < tokens.length; i++) {
        if (searchable.includes(tokens[i])) {
          let df = 0;
          for (const ag of allGroups) {
            if (buildSearchable(ag).includes(tokens[i])) df++;
          }
          df = Math.max(df, 1);
          const tokenScore = 1 / df + (i === 0 ? 0.1 : 0);
          score += tokenScore;
          details.push(`${tokens[i]}:1/${df}${i === 0 ? '+0.1' : ''}=${tokenScore.toFixed(3)}`);
        }
      }
      console.log(`    ${g.name} → score=${score.toFixed(3)} pri=${g.priority} [${details.join(', ')}]`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
