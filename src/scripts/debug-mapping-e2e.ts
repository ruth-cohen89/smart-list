/**
 * End-to-end mapping debugger for מלח, סוכר לבן, סוכר חום
 * Usage: npx ts-node src/scripts/debug-mapping-e2e.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ProductGroupMongoose from '../infrastructure/db/product-group.mongoose.model';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { normalizeForMatching, normalizeName, tokenize } from '../utils/normalize';

const TARGET_GROUPS = ['מלח', 'סוכר לבן', 'סוכר חום'];

const substringRegexCache = new Map<string, RegExp>();
function substringMatch(text: string, token: string): boolean {
  if (token.length <= 3) {
    let re = substringRegexCache.get(token);
    if (!re) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(`(?:^|\\s)${escaped}`);
      substringRegexCache.set(token, re);
    }
    return re.test(text);
  }
  return text.includes(token);
}

function uniqueTokenSets(sets: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const s of sets) {
    const uniq = [...new Set(s)];
    if (uniq.length === 0) continue;
    const key = uniq.join('\u0000');
    if (!seen.has(key)) { seen.add(key); out.push(uniq); }
  }
  return out;
}

async function main() {
  await connectMongo();

  for (const groupName of TARGET_GROUPS) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`GROUP: ${groupName}`);
    console.log('═'.repeat(70));

    const groupDoc = await ProductGroupMongoose.findOne({ normalizedName: normalizeName(groupName) }).lean();

    if (!groupDoc) {
      console.log(`  ❌ GROUP NOT FOUND IN DB`);
      continue;
    }

    console.log(`\n[GROUP DOC]`);
    console.log(`  name="${groupDoc.name}" normalizedName="${groupDoc.normalizedName}"`);
    console.log(`  includeKeywords=[${(groupDoc.includeKeywords ?? []).map(k => `"${k}"`).join(', ')}]`);
    console.log(`  excludeKeywords=[${(groupDoc.excludeKeywords ?? []).map(k => `"${k}"`).join(', ')}]`);
    console.log(`  aliases=[${(groupDoc.aliases ?? []).map(a => `"${a}"`).join(', ')}]`);
    console.log(`  keywords=[${(groupDoc.keywords ?? []).map(k => `"${k}"`).join(', ')}]`);

    // Replicate buildMatchingRules
    const includeTokens = [...new Set((groupDoc.includeKeywords ?? []).flatMap(kw => tokenize(normalizeForMatching(kw))))];
    const aliasTokenSets = (groupDoc.aliases ?? [])
      .map(alias => [...new Set(tokenize(normalizeForMatching(alias)))])
      .filter(t => t.length > 0);

    let includeTokenSets = uniqueTokenSets([
      ...(includeTokens.length > 0 ? [includeTokens] : []),
      ...aliasTokenSets,
    ]);

    const includeSet = new Set(includeTokenSets.flat());
    const groupNameTokens = tokenize(normalizeForMatching(groupDoc.name));
    const normalizedKeywords: string[] = groupDoc.normalizedKeywords ?? [];
    const allGeneral = [
      ...normalizedKeywords.flatMap(kw => tokenize(normalizeForMatching(kw))),
      ...groupNameTokens,
    ];
    let generalTokens = [...new Set(allGeneral.filter(t => !includeSet.has(t)))];

    if (includeTokens.length === 0 && generalTokens.length > 0) {
      includeTokens.push(...generalTokens.splice(0));
      includeTokenSets = uniqueTokenSets([includeTokens, ...aliasTokenSets]);
    }

    const excludeTokens = [...new Set(
      (groupDoc.excludeKeywords ?? []).flatMap(kw => tokenize(normalizeForMatching(kw)))
    )];

    const dbQueryTokenSets = (includeTokenSets.length > 0 ? includeTokenSets : [[...includeTokens, ...generalTokens]])
      .map(tokens => tokens.map(t => t.replace(/%/g, '')).filter(Boolean))
      .filter(tokens => tokens.length > 0);

    console.log(`\n[RULES]`);
    console.log(`  includeTokens=[${includeTokens.map(t => `"${t}"(${t.length})`).join(', ')}]`);
    console.log(`  includeTokenSets=[${includeTokenSets.map(s => '['+s.join(',')+']').join(', ')}]`);
    console.log(`  excludeTokens=[${excludeTokens.map(t => `"${t}"(${t.length})`).join(', ')}]`);
    console.log(`  dbQueryTokenSets=[${dbQueryTokenSets.map(s => '['+s.join(',')+']').join(', ')}]`);

    // DB queries
    console.log(`\n[DB QUERIES]`);
    const allCandidates = new Map<string, Record<string, any>>();

    for (const tokenSet of dbQueryTokenSets) {
      const tokens = tokenSet.join(' ').split(' ')
        .filter(t => t.length >= 2 || /^\d+$/.test(t))
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      if (tokens.length === 0) continue;
      const wrapToken = (t: string) => /^\d{1,2}$/.test(t) ? `\\b${t}\\b` : t;
      const regexPattern = tokens.length === 1
        ? wrapToken(tokens[0])
        : tokens.map(t => `(?=.*${wrapToken(t)})`).join('');

      const docs = await ChainProductMongoose.find({
        isActive: true,
        normalizedName: { $regex: regexPattern, $options: 'i' },
      }).limit(200).lean();

      console.log(`  [${tokenSet.join(',')}] regex="${regexPattern}" → ${docs.length} candidates`);
      if (docs.length > 0 && docs.length <= 3) {
        for (const d of docs) {
          console.log(`    example: chain=${d.chainId} original="${d.originalName}" normalized="${d.normalizedName}"`);
        }
      } else if (docs.length > 0) {
        const d = docs[0];
        console.log(`    first: chain=${d.chainId} original="${d.originalName}" normalized="${d.normalizedName}"`);
      }

      for (const doc of docs) allCandidates.set(String(doc._id), doc);
    }

    console.log(`  Total unique candidates: ${allCandidates.size}`);

    if (allCandidates.size === 0) {
      // Check raw
      const firstToken = includeTokens[0] ?? groupDoc.normalizedName;
      const rawCount = await ChainProductMongoose.countDocuments({ isActive: true, normalizedName: { $regex: firstToken, $options: 'i' } });
      console.log(`  RAW count with "${firstToken}" in normalizedName (no chainId filter): ${rawCount}`);
      if (rawCount > 0) {
        const s = await ChainProductMongoose.find({ isActive: true, normalizedName: { $regex: firstToken, $options: 'i' } }).limit(3).lean();
        for (const d of s) console.log(`    chain=${d.chainId} original="${d.originalName}" normalized="${d.normalizedName}"`);
      }
      continue;
    }

    // Score all candidates
    console.log(`\n[SCORING ${allCandidates.size} candidates]`);
    let cntExclude = 0, cntIncludeFailOLD = 0, cntIncludeFailNEW = 0, cntPass = 0;
    const passSamples: string[] = [];
    const fixedSamples: string[] = [];
    const failSamples: string[] = [];

    for (const doc of allCandidates.values()) {
      const normalized = normalizeForMatching(doc.originalName as string);
      const candidateTokens = new Set(tokenize(normalized));

      // Exclude
      let excluded = false;
      let excludedBy = '';
      for (const token of excludeTokens) {
        if (candidateTokens.has(token)) { excluded = true; excludedBy = `exact:"${token}"`; break; }
        if (substringMatch(normalized, token)) { excluded = true; excludedBy = `substringMatch:"${token}"`; break; }
      }
      if (excluded) {
        cntExclude++;
        if (cntExclude <= 2) console.log(`  [EXCLUDED] "${doc.originalName}" by ${excludedBy}`);
        continue;
      }

      // Include OLD (substringMatch)
      let matchOLD: string[] | null = null;
      for (const ts of includeTokenSets) {
        if (ts.every(t => candidateTokens.has(t) || substringMatch(normalized, t))) { matchOLD = ts; break; }
      }

      // Include NEW (text.includes)
      let matchNEW: string[] | null = null;
      for (const ts of includeTokenSets) {
        if (ts.every(t => candidateTokens.has(t) || normalized.includes(t))) { matchNEW = ts; break; }
      }

      if (!matchOLD && matchNEW) {
        cntIncludeFailOLD++;
        if (fixedSamples.length < 3) {
          fixedSamples.push(`"${doc.originalName}" → normalized="${normalized}" tokens=[${[...candidateTokens].join(',')}] matchedSet=[${matchNEW.join(',')}]`);
        }
      } else if (!matchNEW) {
        cntIncludeFailNEW++;
        if (failSamples.length < 5) {
          const details = includeTokenSets.map(ts =>
            ts.map(t => `${t}(has=${candidateTokens.has(t)},inc=${normalized.includes(t)},sub=${substringMatch(normalized,t)})`).join(' ')
          ).join(' | ');
          failSamples.push(`"${doc.originalName}" → normalized="${normalized}"\n      tokenSets: ${details}`);
        }
      } else {
        cntPass++;
        if (passSamples.length < 3) {
          passSamples.push(`"${doc.originalName}" chain=${doc.chainId} price=${doc.price}`);
        }
      }
    }

    console.log(`\n  TOTALS:`);
    console.log(`    Excluded by exclude tokens: ${cntExclude}`);
    console.log(`    Fixed by OLD→NEW include change: ${cntIncludeFailOLD}`);
    console.log(`    Still fails include (even with text.includes): ${cntIncludeFailNEW}`);
    console.log(`    Passes include: ${cntPass}`);

    if (fixedSamples.length > 0) {
      console.log(`\n  SAMPLES fixed by substringMatch→includes:`);
      fixedSamples.forEach(s => console.log(`    🔧 ${s}`));
    }
    if (failSamples.length > 0) {
      console.log(`\n  SAMPLES still failing include check:`);
      failSamples.forEach(s => console.log(`    ❌ ${s}`));
    }
    if (passSamples.length > 0) {
      console.log(`\n  SAMPLES passing:`);
      passSamples.forEach(s => console.log(`    ✅ ${s}`));
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
