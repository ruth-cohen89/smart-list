// Usage: npx ts-node --transpile-only scripts/debug-shufersal-produce.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import mongoose from 'mongoose';
import { normalizeName } from '../src/utils/normalize';
import {
  matchProduceCanonical,
  PRODUCE_HARD_EXCLUDE_TOKENS,
  PRODUCE_SUBTYPE_TOKENS,
} from '../src/data/produce-catalog';
import { tokenSet } from '../src/utils/scoring';
import { ChainProductRepository } from '../src/repositories/chain-product.repository';
import { ProductRepository } from '../src/repositories/product.repository';
import ChainProductMongoose from '../src/infrastructure/db/chain-product.mongoose.model';

const CHAIN = 'shufersal';

// Exactly the items that are producing false positives
const CASES: string[] = [
  'עגבניות',
  'מלפפון',
  'בטטה',
  'חציל',
  'כרובית',
  'קישוא',
  'ברוקולי',
];

function sep(label: string) {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${label}`);
  console.log('═'.repeat(80));
}

function hr() {
  console.log('  ' + '─'.repeat(76));
}

function classifyCandidate(
  normalizedName: string,
  entryExcludeTokens: readonly string[],
): { cls: 'base' | 'subtype' | 'excluded'; reason: string } {
  if (/[a-z]/.test(normalizedName))
    return { cls: 'excluded', reason: 'Latin chars (branded/packaged)' };
  const hardToken = PRODUCE_HARD_EXCLUDE_TOKENS.find((t) => normalizedName.includes(t));
  if (hardToken) return { cls: 'excluded', reason: `HARD_EXCLUDE_TOKEN: "${hardToken}"` };
  const entryToken = entryExcludeTokens.find((t) => normalizedName.includes(t));
  if (entryToken) return { cls: 'excluded', reason: `entry excludeToken: "${entryToken}"` };
  const subtypeToken = PRODUCE_SUBTYPE_TOKENS.find((t) => normalizedName.includes(t));
  if (subtypeToken) return { cls: 'subtype', reason: `SUBTYPE_TOKEN: "${subtypeToken}"` };
  return { cls: 'base', reason: 'clean fresh produce' };
}

function tokenScore(input: string, candidateNorm: string): number {
  const inputTokens = tokenSet(input);
  const candidateTokens = tokenSet(candidateNorm);
  const intersection = [...inputTokens].filter((t) => candidateTokens.has(t)).length;
  return inputTokens.size > 0 ? intersection / inputTokens.size : 0;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);
  const cpRepo = new ChainProductRepository();
  const prodRepo = new ProductRepository();

  for (const itemName of CASES) {
    const normalized = normalizeName(itemName);
    sep(`ITEM: "${itemName}"  →  normalized: "${normalized}"`);

    // ── Catalog resolution ──────────────────────────────────────────────────
    const pm = matchProduceCanonical(normalized);
    if (!pm) {
      console.log(`  [CATALOG] ✗ NOT MATCHED — would fall through to packaged matching`);
      continue;
    }
    console.log(
      `  [CATALOG] ✓ canonicalKey="${pm.entry.canonicalKey}"  matchedAlias="${pm.matchedAlias}"`,
    );
    console.log(`  [CATALOG]   normalizedAliases: [${pm.entry.normalizedAliases.join(', ')}]`);
    console.log(`  [CATALOG]   excludeTokens: [${(pm.entry.excludeTokens ?? []).join(', ')}]`);

    const entryExcludeTokens = pm.entry.excludeTokens ?? [];
    const normalizedAliases = pm.entry.normalizedAliases;

    // ── Global product ──────────────────────────────────────────────────────
    const globalProd = await prodRepo.findByCanonicalKey(pm.entry.canonicalKey);
    console.log(
      `\n  [GLOBAL_PRODUCT] ${globalProd ? `id=${globalProd.id}  type=${globalProd.productType}` : '⚠ NOT IN DB — Source 1 will always be empty'}`,
    );

    // ── SOURCE 1: findByProductId ───────────────────────────────────────────
    console.log('\n  ┌─ SOURCE 1: findByProductId ──────────────────────────────────────────┐');
    const byId = globalProd
      ? await cpRepo.findByProductId(globalProd.id, CHAIN)
      : [];
    console.log(`  │  raw results: ${byId.length}`);

    const src1Passing: typeof byId = [];
    for (const p of byId) {
      const name = p.normalizedName ?? '';
      const aliasOk = normalizedAliases.some(
        (a) => name === a || name.startsWith(a + ' '),
      );
      const { cls, reason } = classifyCandidate(name, entryExcludeTokens);
      const score = tokenScore(normalized, name);
      const passAlias = aliasOk ? '✓' : '✗ FAIL_ALIAS_START';
      const passCls = cls !== 'excluded' ? `✓ ${cls}` : `✗ excluded`;
      const passScore = score >= 0.7 ? `✓ ${score.toFixed(2)}` : `✗ ${score.toFixed(2)}<0.7`;
      const overall = aliasOk && cls !== 'excluded' && score >= 0.7 ? '→ SURVIVES' : '→ DROPPED';
      console.log(`  │`);
      console.log(`  │  "${p.originalName}"`);
      console.log(`  │    norm="${name}"  productType=${p.productType ?? '-'}  productId=${p.productId ?? '-'}`);
      console.log(`  │    alias:  ${passAlias}`);
      console.log(`  │    class:  ${passCls}  (${reason})`);
      console.log(`  │    score:  ${passScore}`);
      console.log(`  │    ${overall}`);
      if (aliasOk && cls !== 'excluded' && score >= 0.7) src1Passing.push(p);
    }
    if (byId.length === 0) console.log(`  │  (no results)`);
    console.log(`  └─────────────────────────────────────────────────────────────────────┘`);
    console.log(`  Source 1 survivors: ${src1Passing.length}`);

    // ── SOURCE 2: findByProduceAliases (only runs if Source 1 empty) ────────
    let src2Passing: typeof byId = [];
    if (src1Passing.length === 0) {
      console.log('\n  ┌─ SOURCE 2: findByProduceAliases ─────────────────────────────────────┐');
      const byAlias = await cpRepo.findByProduceAliases(CHAIN, normalizedAliases);
      console.log(`  │  raw results: ${byAlias.length}`);

      for (const p of byAlias) {
        const name = p.normalizedName ?? '';
        const { cls, reason } = classifyCandidate(name, entryExcludeTokens);
        const score = tokenScore(normalized, name);
        const passCls = cls !== 'excluded' ? `✓ ${cls}` : `✗ excluded`;
        const passScore = score >= 0.7 ? `✓ ${score.toFixed(2)}` : `✗ ${score.toFixed(2)}<0.7`;
        const overall = cls !== 'excluded' && score >= 0.7 ? '→ SURVIVES' : '→ DROPPED';
        console.log(`  │`);
        console.log(`  │  "${p.originalName}"`);
        console.log(`  │    norm="${name}"  productType=${p.productType ?? '-'}  productId=${p.productId ?? '-'}`);
        console.log(`  │    class:  ${passCls}  (${reason})`);
        console.log(`  │    score:  ${passScore}`);
        console.log(`  │    ${overall}`);
        if (cls !== 'excluded' && score >= 0.7) src2Passing.push(p);
      }
      if (byAlias.length === 0) console.log(`  │  (no results)`);
      console.log(`  └─────────────────────────────────────────────────────────────────────┘`);
      console.log(`  Source 2 survivors: ${src2Passing.length}`);
    } else {
      console.log(`\n  [SOURCE 2 SKIPPED — Source 1 had survivors]`);
    }

    // ── Final winner ────────────────────────────────────────────────────────
    const allSurvivors = src1Passing.length > 0 ? src1Passing : src2Passing;
    hr();
    if (allSurvivors.length === 0) {
      console.log(`  ► RESULT: NULL (no survivor after filtering + scoring)`);
    } else {
      const best = allSurvivors[0];
      console.log(`  ► RESULT: "${best.originalName}"  (norm="${best.normalizedName}"  score=${tokenScore(normalized, best.normalizedName ?? '').toFixed(2)})`);
    }

    // ── Ground truth: does a real fresh-produce row exist? ─────────────────
    const aliasPatterns = normalizedAliases.map(
      (a) => `(^${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$))`,
    );
    const freshDocs = await ChainProductMongoose.find({
      chainId: CHAIN,
      isActive: true,
      normalizedName: { $regex: aliasPatterns.join('|'), $options: 'i' },
    })
      .limit(10)
      .lean();

    console.log(`\n  [GROUND_TRUTH] alias-start rows in Shufersal DB: ${freshDocs.length}`);
    for (const d of freshDocs) {
      console.log(
        `    "${d.originalName}"  norm="${d.normalizedName}"  productType=${d.productType ?? '-'}  productId=${d.productId?.toString() ?? '-'}  price=${d.price}  weighted=${d.isWeighted}`,
      );
    }
  }

  await mongoose.disconnect();
  console.log('\n[DONE]');
}

run().catch(console.error);
