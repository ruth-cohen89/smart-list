/**
 * E2E mapping debug for סודה / מים מוגזים, אבקת אפייה
 * Usage: npx ts-node src/scripts/debug-soda-baking-tissue2.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ProductGroupMongoose from '../infrastructure/db/product-group.mongoose.model';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { normalizeForMatching, normalizeName, tokenize } from '../utils/normalize';

const TARGET_GROUPS = ['סודה / מים מוגזים', 'אבקת אפייה'];

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

    const normalizedSearch = normalizeName(groupName);
    console.log(`  searching DB for normalizedName="${normalizedSearch}"`);

    const groupDoc = await ProductGroupMongoose.findOne({ normalizedName: normalizedSearch }).lean();

    if (!groupDoc) {
      console.log(`  ❌ GROUP NOT FOUND IN DB`);
      // Try substring search
      const groups = await ProductGroupMongoose.find({
        normalizedName: { $regex: normalizedSearch.split(' ')[0], $options: 'i' }
      }).lean();
      if (groups.length > 0) {
        console.log(`  Similar groups in DB:`);
        for (const g of groups) console.log(`    "${g.name}" normalizedName="${g.normalizedName}"`);
      }
      continue;
    }

    console.log(`\n[GROUP DOC]`);
    console.log(`  name="${groupDoc.name}" normalizedName="${groupDoc.normalizedName}"`);
    console.log(`  includeKeywords=[${(groupDoc.includeKeywords ?? []).map((k: string) => `"${k}"`).join(', ')}]`);
    console.log(`  excludeKeywords=[${(groupDoc.excludeKeywords ?? []).map((k: string) => `"${k}"`).join(', ')}]`);
    console.log(`  aliases=[${(groupDoc.aliases ?? []).map((a: string) => `"${a}"`).join(', ')}]`);
    console.log(`  keywords=[${(groupDoc.keywords ?? []).map((k: string) => `"${k}"`).join(', ')}]`);

    const includeTokens = [...new Set((groupDoc.includeKeywords ?? []).flatMap((kw: string) => tokenize(normalizeForMatching(kw))))];
    const aliasTokenSets = (groupDoc.aliases ?? [])
      .map((alias: string) => [...new Set(tokenize(normalizeForMatching(alias)))])
      .filter((t: string[]) => t.length > 0);

    let includeTokenSets = uniqueTokenSets([
      ...(includeTokens.length > 0 ? [includeTokens] : []),
      ...aliasTokenSets,
    ]);

    const includeSet = new Set(includeTokenSets.flat());
    const groupNameTokens = tokenize(normalizeForMatching(groupDoc.name));
    const normalizedKeywords: string[] = groupDoc.normalizedKeywords ?? [];
    const allGeneral = [
      ...normalizedKeywords.flatMap((kw: string) => tokenize(normalizeForMatching(kw))),
      ...groupNameTokens,
    ];
    let generalTokens = [...new Set(allGeneral.filter((t: string) => !includeSet.has(t)))];

    if (includeTokens.length === 0 && generalTokens.length > 0) {
      includeTokens.push(...generalTokens.splice(0));
      includeTokenSets = uniqueTokenSets([includeTokens, ...aliasTokenSets]);
    }

    const excludeTokens = [...new Set(
      (groupDoc.excludeKeywords ?? []).flatMap((kw: string) => tokenize(normalizeForMatching(kw)))
    )];

    const dbQueryTokenSets = (includeTokenSets.length > 0 ? includeTokenSets : [[...includeTokens, ...generalTokens]])
      .map((tokens: string[]) => tokens.map((t: string) => t.replace(/%/g, '')).filter(Boolean))
      .filter((tokens: string[]) => tokens.length > 0);

    console.log(`\n[RULES]`);
    console.log(`  includeTokens=[${includeTokens.map((t: string) => `"${t}"(len=${t.length})`).join(', ')}]`);
    console.log(`  includeTokenSets=[${includeTokenSets.map((s: string[]) => '['+s.join(',')+']').join(', ')}]`);
    console.log(`  excludeTokens=[${excludeTokens.map((t: string) => `"${t}"`).join(', ')}]`);
    console.log(`  dbQueryTokenSets=[${dbQueryTokenSets.map((s: string[]) => '['+s.join(',')+']').join(', ')}]`);

    console.log(`\n[DB QUERIES]`);
    const allCandidates = new Map<string, Record<string, any>>();

    for (const tokenSet of dbQueryTokenSets) {
      const tokens = tokenSet.join(' ').split(' ')
        .filter((t: string) => t.length >= 2 || /^\d+$/.test(t))
        .map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      if (tokens.length === 0) continue;
      const wrapToken = (t: string) => /^\d{1,2}$/.test(t) ? `\\b${t}\\b` : t;
      const regexPattern = tokens.length === 1
        ? wrapToken(tokens[0])
        : tokens.map((t: string) => `(?=.*${wrapToken(t)})`).join('');

      const docs = await ChainProductMongoose.find({
        isActive: true,
        normalizedName: { $regex: regexPattern, $options: 'i' },
      }).limit(200).lean();

      console.log(`  [${tokenSet.join(',')}] regex="${regexPattern}" → ${docs.length} candidates`);
      if (docs.length > 0) {
        for (const d of docs.slice(0, 3)) {
          console.log(`    example: chain=${d.chainId} original="${d.originalName}" normalized="${d.normalizedName}"`);
        }
      }

      for (const doc of docs) allCandidates.set(String(doc._id), doc);
    }

    console.log(`\n  Total unique candidates: ${allCandidates.size}`);

    if (allCandidates.size === 0) {
      const firstToken = includeTokens[0] ?? groupDoc.normalizedName.split(' ')[0];
      const rawCount = await ChainProductMongoose.countDocuments({ isActive: true, normalizedName: { $regex: firstToken, $options: 'i' } });
      console.log(`  RAW count with "${firstToken}" in normalizedName: ${rawCount}`);
      continue;
    }

    console.log(`\n[SCORING ${allCandidates.size} candidates]`);
    let cntExclude = 0, cntFail = 0, cntPass = 0;
    const passSamples: string[] = [];
    const failSamples: string[] = [];
    const excludeSamples: string[] = [];

    for (const doc of allCandidates.values()) {
      const normalized = normalizeForMatching(doc.originalName as string);
      const candidateTokens = new Set(tokenize(normalized));

      let excluded = false;
      let excludedBy = '';
      for (const token of excludeTokens) {
        if (candidateTokens.has(token)) { excluded = true; excludedBy = `exact:"${token}"`; break; }
        if (substringMatch(normalized, token)) { excluded = true; excludedBy = `substr:"${token}"`; break; }
      }
      if (excluded) {
        cntExclude++;
        if (excludeSamples.length < 3) excludeSamples.push(`"${doc.originalName}" by ${excludedBy}`);
        continue;
      }

      let matched: string[] | null = null;
      for (const ts of includeTokenSets) {
        if (ts.every((t: string) => candidateTokens.has(t) || normalized.includes(t))) { matched = ts; break; }
      }

      if (!matched) {
        cntFail++;
        if (failSamples.length < 5) {
          const details = includeTokenSets.map((ts: string[]) =>
            ts.map((t: string) => `${t}(has=${candidateTokens.has(t)},inc=${normalized.includes(t)})`).join(' ')
          ).join(' | ');
          failSamples.push(`"${doc.originalName}" → norm="${normalized}"\n      ${details}`);
        }
      } else {
        cntPass++;
        if (passSamples.length < 5) passSamples.push(`"${doc.originalName}" chain=${doc.chainId}`);
      }
    }

    console.log(`  Excluded: ${cntExclude}, Failed include: ${cntFail}, Passed: ${cntPass}`);
    if (excludeSamples.length) { console.log(`  EXCLUDED samples:`); excludeSamples.forEach(s => console.log(`    ❌ ${s}`)); }
    if (failSamples.length) { console.log(`  FAILED include samples:`); failSamples.forEach(s => console.log(`    ⚠️  ${s}`)); }
    if (passSamples.length) { console.log(`  PASSED samples:`); passSamples.forEach(s => console.log(`    ✅ ${s}`)); }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
