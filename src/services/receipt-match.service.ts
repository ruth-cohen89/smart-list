import { AppError } from '../errors/app-error';
import { normalizeName } from '../utils/normalize';
import { ReceiptRepository } from '../repositories/receipt.repository';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ConsumptionProfileRepository } from '../repositories/consumption-profile.repository';

import type { ShoppingItem } from '../models/shopping-list.model';
import type { BaselineItem } from '../models/consumption-profile.model';

// ─── Response types ───────────────────────────────────────────────────────────

export interface MatchedShoppingListItem {
  receiptItemName: string;
  shoppingListItemId: string;
  shoppingListItemName: string;
}

export interface UpdatedBaselineItem {
  receiptItemName: string;
  baselineItemId: string;
  baselineItemName: string;
}

export interface UnmatchedReceiptItem {
  receiptItemName: string;
}

export interface MatchReceiptItemsResult {
  receiptId: string;
  matchedShoppingListItems: MatchedShoppingListItem[];
  updatedBaselineItems: UpdatedBaselineItem[];
  unmatchedReceiptItems: UnmatchedReceiptItem[];
}

// ─── Matching utilities ───────────────────────────────────────────────────────

// Tokens too noisy to contribute to a match.
const NOISE_TOKENS = new Set([
  'מבצע',
  'ליח',
  'יח',
  'גרם',
  'קג',
  'קילו',
  'מארז',
  'פיקדון',
  'בטעם',
]);

// Richer normalization for matching only — does not replace the parser's normalizeName.
function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u200f\u200e\u202a-\u202e\u2066-\u2069]/g, '') // bidi control chars
    .replace(/[^\w\u05d0-\u05ea\s]/g, ' ') // keep Hebrew, ASCII word chars, spaces
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0 && !NOISE_TOKENS.has(t))
    .join(' ');
}

// Minimum score to accept a match. Conservative to avoid false positives.
const MATCH_THRESHOLD = 0.5;

// Returns a score in [0, 1].
// Strategy (in order of confidence):
//   1. Exact normalized match           → 1.0
//   2. One string contains the other    → 0.9
//   3. Token overlap (common / candidate tokens) — biased so that a short
//      candidate that is fully contained in a longer receipt string scores high.
function matchScore(receiptNorm: string, candidateNorm: string): number {
  if (!receiptNorm || !candidateNorm) return 0;
  if (receiptNorm === candidateNorm) return 1.0;
  if (receiptNorm.includes(candidateNorm) || candidateNorm.includes(receiptNorm)) return 0.9;

  const receiptTokens = new Set(receiptNorm.split(' ').filter(Boolean));
  const candidateTokens = candidateNorm.split(' ').filter(Boolean);
  if (candidateTokens.length === 0) return 0;

  let common = 0;
  for (const t of candidateTokens) {
    if (receiptTokens.has(t)) common++;
  }
  return common / candidateTokens.length;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ReceiptMatchService {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly shoppingListRepo: ShoppingListRepository,
    private readonly consumptionRepo: ConsumptionProfileRepository,
  ) {}

  async matchReceiptItems(userId: string, receiptId: string): Promise<MatchReceiptItemsResult> {
    const receipt = await this.receiptRepo.findByIdAndUser(receiptId, userId);
    if (!receipt) throw new AppError('Receipt not found', 404);

    const [activeList, profile] = await Promise.all([
      this.shoppingListRepo.findActiveList(userId),
      this.consumptionRepo.getOrCreate(userId),
    ]);

    const matchedShoppingListItems: MatchedShoppingListItem[] = [];
    const updatedBaselineItems: UpdatedBaselineItem[] = [];
    const unmatchedReceiptItems: UnmatchedReceiptItem[] = [];

    // Track what we have already mutated in this request to stay idempotent.
    const purchasedListItemIds = new Set<string>();
    const updatedBaselineNormNames = new Set<string>();

    for (const receiptItem of receipt.items) {
      const receiptNorm = normalizeForMatch(receiptItem.normalizedName ?? receiptItem.name);
      let matched = false;

      // ── 1. Match against active shopping list items ─────────────────────────
      if (activeList) {
        let bestItem: ShoppingItem | null = null;
        let bestScore = 0;

        for (const listItem of activeList.items) {
          if (purchasedListItemIds.has(listItem.id)) continue; // already purchased in this run
          const score = matchScore(receiptNorm, normalizeForMatch(listItem.name));
          if (score > bestScore) {
            bestScore = score;
            bestItem = listItem;
          }
        }

        if (bestScore >= MATCH_THRESHOLD && bestItem) {
          purchasedListItemIds.add(bestItem.id);

          // Remove from active list — mirrors purchaseItemInActiveList behaviour.
          await this.shoppingListRepo.deleteItem(userId, activeList.id, bestItem.id);

          // Update baseline best-effort (increment usageScore + lastPurchasedAt).
          const listItemNorm = normalizeName(bestItem.name);
          if (!updatedBaselineNormNames.has(listItemNorm)) {
            await this.consumptionRepo.markPurchasedByNormalizedName(userId, listItemNorm);
            updatedBaselineNormNames.add(listItemNorm);
          }

          matchedShoppingListItems.push({
            receiptItemName: receiptItem.name,
            shoppingListItemId: bestItem.id,
            shoppingListItemName: bestItem.name,
          });
          matched = true;
        }
      }

      // ── 2. Match against baseline items ────────────────────────────────────
      {
        let bestItem: BaselineItem | null = null;
        let bestScore = 0;

        for (const bItem of profile.baselineItems) {
          const score = matchScore(receiptNorm, normalizeForMatch(bItem.normalizedName ?? bItem.name));
          if (score > bestScore) {
            bestScore = score;
            bestItem = bItem;
          }
        }

        if (
          bestScore >= MATCH_THRESHOLD &&
          bestItem &&
          !updatedBaselineNormNames.has(bestItem.normalizedName)
        ) {
          updatedBaselineNormNames.add(bestItem.normalizedName);
          await this.consumptionRepo.markPurchasedByNormalizedName(userId, bestItem.normalizedName);

          updatedBaselineItems.push({
            receiptItemName: receiptItem.name,
            baselineItemId: bestItem.id,
            baselineItemName: bestItem.name,
          });
          matched = true;
        }
      }

      if (!matched) {
        unmatchedReceiptItems.push({ receiptItemName: receiptItem.name });
      }
    }

    return {
      receiptId: receipt.id,
      matchedShoppingListItems,
      updatedBaselineItems,
      unmatchedReceiptItems,
    };
  }
}
