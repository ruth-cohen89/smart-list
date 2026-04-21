// Usage: npx ts-node --transpile-only scripts/debug-produce-matching.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import mongoose from 'mongoose';
import { normalizeName } from '../src/utils/normalize';
import { matchProduceCanonical } from '../src/data/produce-catalog';
import { tokenSet, scoreProduct } from '../src/utils/scoring';
import { ChainProductRepository } from '../src/repositories/chain-product.repository';
import { ProductRepository } from '../src/repositories/product.repository';
import ChainProductMongoose from '../src/infrastructure/db/chain-product.mongoose.model';

const CHAIN = 'shufersal';

const CASES: [string, string][] = [
  ['עגבניה', 'עגבניה'],
  ['מלפפון', 'מלפפון'],
  ['פלפל', 'פלפל ירוק'],
  ['תפוח אדמה', 'תפוח אדמה'],
  ['חציל', 'חציל'],
  ['בטטה', 'בטטה'],
  ['בצל אדום', 'בצל אדום'],
  ['שום', 'שום'],
  ['לימון', 'לימון'],
];

function sep(label: string) {
  console.log('\n' + '='.repeat(72));
  console.log(`  ${label}`);
  console.log('='.repeat(72));
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);
  const cpRepo = new ChainProductRepository();
  const prodRepo = new ProductRepository();

  for (const [rawName, expectedTerm] of CASES) {
    const normalized = normalizeName(rawName);
    sep(`ITEM: "${rawName}"  →  normalized: "${normalized}"`);

    // ── Step 1: catalog resolution ───────────────────────────────────────────
    const pm = matchProduceCanonical(normalized);
    if (pm) {
      console.log(
        `\n[CATALOG] canonicalKey="${pm.entry.canonicalKey}"  matchedAlias="${pm.matchedAlias}"`,
      );
    } else {
      console.log(`\n[CATALOG] NO MATCH → name-only path`);
    }

    if (pm) {
      // ── Step 2: matchByProduce path ──────────────────────────────────────
      const globalProd = await prodRepo.findByCanonicalKey(pm.entry.canonicalKey);
      console.log(
        `\n[PRODUCE PATH] globalProduct=${globalProd ? globalProd.id : 'NOT FOUND IN DB'}`,
      );

      const excludeTokens = pm.entry.excludeTokens ?? [];
      const aliases = pm.entry.normalizedAliases;

      let producePathWinner: string | null = null;

      if (globalProd) {
        const linked = await cpRepo.findByProductId(globalProd.id, CHAIN);
        console.log(`[PRODUCE PATH] findByProductId → ${linked.length} doc(s)`);

        const passing: typeof linked = [];
        for (const cp of linked) {
          const name = cp.normalizedName ?? '';
          const failToken = excludeTokens.find((t) => name.includes(t));
          const passesAlias = aliases.some((a) => name === a || name.startsWith(a + ' '));
          let verdict: string;
          if (failToken) {
            verdict = `FAIL_EXCLUDE(${failToken})`;
          } else if (!passesAlias) {
            verdict = 'FAIL_ALIAS_START';
          } else {
            verdict = 'PASS';
            passing.push(cp);
          }
          console.log(
            `  ${pad(verdict, 26)} "${cp.originalName}"` +
              `  price=${cp.price}  weighted=${cp.isWeighted}  productId=${cp.productId ?? '-'}`,
          );
        }

        if (passing.length > 0) {
          const hasWeighted = passing.some((p) => p.isWeighted);
          const pool = hasWeighted ? passing.filter((p) => p.isWeighted) : passing;
          const best = pool.sort((a, b) => {
            const aT = (a.normalizedName ?? '').split(' ').filter(Boolean).length;
            const bT = (b.normalizedName ?? '').split(' ').filter(Boolean).length;
            if (aT !== bT) return aT - bT;
            return a.price - b.price;
          })[0];
          producePathWinner = best.originalName;
          console.log(
            `[PRODUCE PATH] WINNER → "${best.originalName}"  (weighted-only=${hasWeighted})`,
          );
        } else {
          console.log(`[PRODUCE PATH] no passing candidates → falls to matchByName fallback`);
        }
      }

      // ── Step 3: matchByName produce fallback (runs when produce path returns null) ──
      if (!producePathWinner) {
        const matchExcludeTokens = pm.entry.matchExcludeTokens ?? [];
        const candidates = await cpRepo.findCandidatesByName(normalized, CHAIN);
        console.log(`\n[NAME_FALLBACK] findCandidatesByName → ${candidates.length} candidate(s)`);

        const afterExclude = candidates.filter(
          (c) => !excludeTokens.some((t) => (c.normalizedName ?? '').includes(t)),
        );
        const wouldBeFilteredByMatchExclude = afterExclude.filter((c) =>
          matchExcludeTokens.some((t) => (c.normalizedName ?? '').includes(t)),
        );
        const afterMatchExclude = afterExclude.filter(
          (c) => !matchExcludeTokens.some((t) => (c.normalizedName ?? '').includes(t)),
        );
        const afterAlias = afterMatchExclude.filter((c) => {
          const n = c.normalizedName ?? '';
          return aliases.some((a) => n === a || n.startsWith(a + ' '));
        });

        console.log(
          `  excludeTokens applied (${excludeTokens.join(', ')}): ${candidates.length} → ${afterExclude.length} remain`,
        );
        if (wouldBeFilteredByMatchExclude.length > 0) {
          console.log(
            `  matchExcludeTokens (currently NOT applied in service!) would remove: ` +
              wouldBeFilteredByMatchExclude.map((c) => `"${c.originalName}"`).join(', '),
          );
        }
        console.log(
          `  matchExcludeTokens (${matchExcludeTokens.join(', ')}): ${afterExclude.length} → ${afterMatchExclude.length} remain`,
        );
        console.log(
          `  alias-start filter (${aliases.join(' | ')}): ${afterMatchExclude.length} → ${afterAlias.length} remain`,
        );

        if (afterAlias.length > 0) {
          console.log(`\n  Candidates passing all filters (top 8 by score):`);
          const inputTokens = tokenSet(normalized);
          const scored = afterAlias
            .map((cp) => {
              const cName = cp.normalizedName ?? '';
              const cTokens = tokenSet(cName);
              let exactMatches = 0;
              let prefixMatches = 0;
              for (const it of inputTokens) {
                if (cTokens.has(it)) {
                  exactMatches++;
                } else {
                  for (const ct of cTokens) {
                    if (ct.startsWith(it) && it.length >= 2) {
                      prefixMatches++;
                      break;
                    }
                  }
                }
              }
              const recall = (exactMatches + prefixMatches) / inputTokens.size;
              let matchedCand = 0;
              for (const ct of cTokens) {
                for (const it of inputTokens) {
                  if (ct === it || ct.startsWith(it)) {
                    matchedCand++;
                    break;
                  }
                }
              }
              const extra = cTokens.size - matchedCand;
              const extraPenalty = (cTokens.size > 0 ? extra / cTokens.size : 0) * 0.55;
              const firstToken = cName.split(' ').filter(Boolean)[0] ?? '';
              const posBonus = [...inputTokens].some(
                (it) => firstToken === it || firstToken.startsWith(it),
              )
                ? 0.08
                : 0;
              const brevity = cTokens.size > 0 ? (1 / cTokens.size) * 0.05 : 0;
              const finalScore = scoreProduct({
                inputTokens,
                normalizedInput: normalized,
                candidateNormalizedName: cName,
              });
              return {
                cp,
                finalScore,
                recall,
                exactMatches,
                prefixMatches,
                extra,
                extraPenalty,
                posBonus,
                brevity,
              };
            })
            .filter((s) => s.finalScore >= 0.45)
            .sort((a, b) => b.finalScore - a.finalScore);

          for (const s of scored.slice(0, 8)) {
            console.log(
              `    score=${s.finalScore.toFixed(3)}` +
                ` rec=${s.recall.toFixed(2)} ex=${s.exactMatches} pfx=${s.prefixMatches}` +
                ` extra=${s.extra} pen=${s.extraPenalty.toFixed(3)} pos=${s.posBonus} brev=${s.brevity.toFixed(3)}` +
                `  → "${s.cp.originalName}"  price=${s.cp.price}  weighted=${s.cp.isWeighted}`,
            );
          }

          if (scored.length > 0) {
            console.log(`[NAME_FALLBACK] WINNER → "${scored[0].cp.originalName}"`);
          } else {
            console.log(`[NAME_FALLBACK] no candidate above threshold 0.45`);
          }
        } else {
          console.log(`  No candidates survive all filters → item would be UNMATCHED`);
        }
      }
    }

    // ── Step 4: Verify correct product exists in DB ──────────────────────────
    const expectedNorm = normalizeName(expectedTerm);
    const escapedExpected = expectedNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const correctDocs = await ChainProductMongoose.find({
      chainId: CHAIN,
      isActive: true,
      normalizedName: { $regex: `^${escapedExpected}`, $options: 'i' },
    })
      .limit(5)
      .lean();

    console.log(
      `\n[CORRECT_PRODUCT_CHECK] "^${expectedNorm}" in DB → ${correctDocs.length} result(s)`,
    );
    for (const c of correctDocs) {
      console.log(
        `  "${c.originalName}"  norm="${c.normalizedName}"  price=${c.price}` +
          `  weighted=${c.isWeighted}  productId=${c.productId ?? '-'}`,
      );
    }
  }

  await mongoose.disconnect();
  console.log('\n[DONE]');
}

run().catch(console.error);
