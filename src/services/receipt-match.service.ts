import { AppError } from '../errors/app-error';
import { normalizeName } from '../utils/normalize';
import { ReceiptRepository } from '../repositories/receipt.repository';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ConsumptionProfileRepository } from '../repositories/consumption-profile.repository';

import type { ShoppingItem } from '../models/shopping-list.model';
import type { BaselineItem } from '../models/consumption-profile.model';

// ─── Response types ───────────────────────────────────────────────────────────

export type MatchStatus = 'autoApproved' | 'pendingConfirmation';

export interface ShoppingListMatchResult {
  status: MatchStatus;
  itemId: string;
  itemName: string;
  score: number;
}

export interface BaselineMatchResult {
  status: MatchStatus;
  itemId: string;
  itemName: string;
  score: number;
}

export interface MatchedReceiptItem {
  receiptItemId: string;
  receiptItemName: string;
  shoppingListMatch: ShoppingListMatchResult | null;
  baselineMatch: BaselineMatchResult | null;
}

export interface UnmatchedReceiptItem {
  receiptItemId: string;
  receiptItemName: string;
}

export interface MatchReceiptItemsResult {
  receiptId: string;
  matchedReceiptItems: MatchedReceiptItem[];
  unmatchedReceiptItems: UnmatchedReceiptItem[];
}

export interface ConfirmReceiptMatchInput {
  receiptItemId: string;
  shoppingListItemId?: string;
  baselineItemId?: string;
}

export interface ConfirmReceiptMatchesInput {
  matches: ConfirmReceiptMatchInput[];
}

export interface ConfirmedReceiptMatchResult {
  receiptItemId: string;
  receiptItemName: string;
  confirmedShoppingListMatch: boolean;
  confirmedBaselineMatch: boolean;
}

export interface ConfirmReceiptMatchesResult {
  receiptId: string;
  confirmedMatches: ConfirmedReceiptMatchResult[];
}

// ─── Matching utilities ───────────────────────────────────────────────────────

const NOISE_TOKENS = new Set(['מבצע', 'ליח', 'יח', 'גרם', 'קג', 'קילו', 'מארז', 'פיקדון', 'בטעם']);

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u200f\u200e\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[^\w\u05d0-\u05ea\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0 && !NOISE_TOKENS.has(t))
    .join(' ');
}

const AUTO_APPROVE_THRESHOLD = 0.9;
const PENDING_THRESHOLD = 0.7;

function getTokens(s: string): string[] {
  return s.split(' ').filter(Boolean);
}

function matchScore(receiptNorm: string, candidateNorm: string): number {
  if (!receiptNorm || !candidateNorm) return 0;
  if (receiptNorm === candidateNorm) return 1.0;
  if (receiptNorm.includes(candidateNorm) || candidateNorm.includes(receiptNorm)) return 0.9;

  const receiptTokens = new Set(getTokens(receiptNorm));
  const candidateTokens = getTokens(candidateNorm);
  if (candidateTokens.length === 0) return 0;

  let common = 0;
  for (const t of candidateTokens) {
    if (receiptTokens.has(t)) common++;
  }

  return common / candidateTokens.length;
}

/**
 * מונע auto-approve על התאמות חלקיות מסוכנות.
 */
function shouldForcePending(receiptNorm: string, candidateNorm: string): boolean {
  if (!receiptNorm || !candidateNorm) return false;
  if (receiptNorm === candidateNorm) return false;

  const receiptTokens = getTokens(receiptNorm);
  const candidateTokens = getTokens(candidateNorm);

  if (
    candidateTokens.length === 1 &&
    receiptTokens.length > 1 &&
    receiptTokens.includes(candidateTokens[0])
  ) {
    return true;
  }

  const sharedTokens = candidateTokens.filter((t) => receiptTokens.includes(t));
  if (
    candidateTokens.length === 1 &&
    sharedTokens.length === 1 &&
    receiptTokens.length > candidateTokens.length
  ) {
    return true;
  }

  return false;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ReceiptMatchService {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly shoppingListRepo: ShoppingListRepository,
    private readonly consumptionRepo: ConsumptionProfileRepository,
  ) {}

  async confirmReceiptMatches(
    userId: string,
    receiptId: string,
    input: ConfirmReceiptMatchesInput,
  ): Promise<ConfirmReceiptMatchesResult> {
    const receipt = await this.receiptRepo.findByIdAndUser(receiptId, userId);
    if (!receipt) throw new AppError('Receipt not found', 404);

    if (!input.matches || input.matches.length === 0) {
      throw new AppError('matches is required and must contain at least one item', 400);
    }

    const activeList = await this.shoppingListRepo.findActiveList(userId);
    const profile = await this.consumptionRepo.getOrCreate(userId);

    const usedReceiptItemIds = new Set<string>();
    const removedShoppingListItemIds = new Set<string>();
    const updatedBaselineNormNames = new Set<string>();
    const usedBaselineItemIds = new Set<string>();

    const confirmedMatches: ConfirmedReceiptMatchResult[] = [];

    for (const match of input.matches) {
      const { receiptItemId, shoppingListItemId, baselineItemId } = match;

      if (!shoppingListItemId && !baselineItemId) {
        throw new AppError(
          `At least one of shoppingListItemId or baselineItemId is required for receipt item "${receiptItemId}"`,
          400,
        );
      }

      if (usedReceiptItemIds.has(receiptItemId)) {
        throw new AppError(`Duplicate receiptItemId in request: "${receiptItemId}"`, 400);
      }
      usedReceiptItemIds.add(receiptItemId);

      if (baselineItemId) {
        if (usedBaselineItemIds.has(baselineItemId)) {
          throw new AppError(
            `Baseline item "${baselineItemId}" was sent more than once in the same request`,
            400,
          );
        }
        usedBaselineItemIds.add(baselineItemId);
      }

      const receiptItem = receipt.items.find((item) => item.id === receiptItemId);
      if (!receiptItem) {
        throw new AppError(`Receipt item not found: "${receiptItemId}"`, 404);
      }

      let confirmedShoppingListMatch = false;
      let confirmedBaselineMatch = false;

      if (shoppingListItemId) {
        if (!activeList) {
          throw new AppError('Active shopping list not found', 404);
        }

        if (removedShoppingListItemIds.has(shoppingListItemId)) {
          throw new AppError(
            `Shopping list item "${shoppingListItemId}" was sent more than once in the same request`,
            400,
          );
        }

        const listItem = activeList.items.find((item) => item.id === shoppingListItemId);
        if (!listItem) {
          throw new AppError(`Shopping list item not found: "${shoppingListItemId}"`, 404);
        }

        await this.shoppingListRepo.deleteItem(userId, activeList.id, listItem.id);
        removedShoppingListItemIds.add(shoppingListItemId);
        confirmedShoppingListMatch = true;
      }

      if (baselineItemId) {
        const baselineItem = profile.baselineItems.find((item) => item.id === baselineItemId);
        if (!baselineItem) {
          throw new AppError(`Baseline item not found: "${baselineItemId}"`, 404);
        }

        const baselineStoredNorm = baselineItem.normalizedName ?? normalizeName(baselineItem.name);

        if (!updatedBaselineNormNames.has(baselineStoredNorm)) {
          await this.consumptionRepo.markPurchasedByNormalizedName(userId, baselineStoredNorm);
          updatedBaselineNormNames.add(baselineStoredNorm);
        }

        confirmedBaselineMatch = true;
      }

      confirmedMatches.push({
        receiptItemId: receiptItem.id,
        receiptItemName: receiptItem.name,
        confirmedShoppingListMatch,
        confirmedBaselineMatch,
      });
    }

    await this.receiptRepo.updateStatus(receiptId, userId, 'APPLIED');

    return {
      receiptId: receipt.id,
      confirmedMatches,
    };
  }

  async matchReceiptItems(userId: string, receiptId: string): Promise<MatchReceiptItemsResult> {
    const receipt = await this.receiptRepo.findByIdAndUser(receiptId, userId);
    if (!receipt) throw new AppError('Receipt not found', 404);

    const [activeList, profile] = await Promise.all([
      this.shoppingListRepo.findActiveList(userId),
      this.consumptionRepo.getOrCreate(userId),
    ]);

    const matchedReceiptItems: MatchedReceiptItem[] = [];
    const unmatchedReceiptItems: UnmatchedReceiptItem[] = [];

    const removedShoppingListItemIds = new Set<string>();
    const updatedBaselineNormNames = new Set<string>();

    for (const receiptItem of receipt.items) {
      const receiptNorm = normalizeForMatch(receiptItem.normalizedName ?? receiptItem.name);

      let bestShoppingListItem: ShoppingItem | null = null;
      let bestShoppingListScore = 0;

      let bestBaselineItem: BaselineItem | null = null;
      let bestBaselineScore = 0;

      if (activeList) {
        for (const listItem of activeList.items) {
          if (removedShoppingListItemIds.has(listItem.id)) continue;

          const candidateNorm = normalizeForMatch(listItem.name);
          const score = matchScore(receiptNorm, candidateNorm);

          if (score > bestShoppingListScore) {
            bestShoppingListScore = score;
            bestShoppingListItem = listItem;
          }
        }
      }

      for (const bItem of profile.baselineItems) {
        const candidateNorm = normalizeForMatch(bItem.normalizedName ?? bItem.name);
        const score = matchScore(receiptNorm, candidateNorm);

        if (score > bestBaselineScore) {
          bestBaselineScore = score;
          bestBaselineItem = bItem;
        }
      }

      let shoppingListMatch: ShoppingListMatchResult | null = null;
      let baselineMatch: BaselineMatchResult | null = null;

      if (bestShoppingListItem) {
        const bestShoppingListNorm = normalizeForMatch(bestShoppingListItem.name);
        const forcePending = shouldForcePending(receiptNorm, bestShoppingListNorm);

        if (bestShoppingListScore >= AUTO_APPROVE_THRESHOLD && !forcePending) {
          shoppingListMatch = {
            status: 'autoApproved',
            itemId: bestShoppingListItem.id,
            itemName: bestShoppingListItem.name,
            score: bestShoppingListScore,
          };

          if (activeList && !removedShoppingListItemIds.has(bestShoppingListItem.id)) {
            removedShoppingListItemIds.add(bestShoppingListItem.id);
            await this.shoppingListRepo.deleteItem(userId, activeList.id, bestShoppingListItem.id);
          }
        } else if (bestShoppingListScore >= PENDING_THRESHOLD) {
          shoppingListMatch = {
            status: 'pendingConfirmation',
            itemId: bestShoppingListItem.id,
            itemName: bestShoppingListItem.name,
            score: bestShoppingListScore,
          };
        }
      }

      if (bestBaselineItem) {
        const bestBaselineNorm = normalizeForMatch(
          bestBaselineItem.normalizedName ?? bestBaselineItem.name,
        );

        const bestBaselineStoredNorm =
          bestBaselineItem.normalizedName ?? normalizeName(bestBaselineItem.name);

        const forcePending = shouldForcePending(receiptNorm, bestBaselineNorm);

        if (
          bestBaselineScore >= AUTO_APPROVE_THRESHOLD &&
          !forcePending &&
          !updatedBaselineNormNames.has(bestBaselineStoredNorm)
        ) {
          baselineMatch = {
            status: 'autoApproved',
            itemId: bestBaselineItem.id,
            itemName: bestBaselineItem.name,
            score: bestBaselineScore,
          };

          updatedBaselineNormNames.add(bestBaselineStoredNorm);
          await this.consumptionRepo.markPurchasedByNormalizedName(userId, bestBaselineStoredNorm);
        } else if (
          bestBaselineScore >= PENDING_THRESHOLD &&
          !updatedBaselineNormNames.has(bestBaselineStoredNorm)
        ) {
          baselineMatch = {
            status: 'pendingConfirmation',
            itemId: bestBaselineItem.id,
            itemName: bestBaselineItem.name,
            score: bestBaselineScore,
          };
        }
      }

      if (shoppingListMatch || baselineMatch) {
        matchedReceiptItems.push({
          receiptItemId: receiptItem.id,
          receiptItemName: receiptItem.name,
          shoppingListMatch,
          baselineMatch,
        });
      } else {
        unmatchedReceiptItems.push({
          receiptItemId: receiptItem.id,
          receiptItemName: receiptItem.name,
        });
      }
    }

    const hasPendingConfirmation = matchedReceiptItems.some(
      (item) =>
        item.shoppingListMatch?.status === 'pendingConfirmation' ||
        item.baselineMatch?.status === 'pendingConfirmation',
    );

    const hasUnmatchedItems = unmatchedReceiptItems.length > 0;

    if (!hasPendingConfirmation && !hasUnmatchedItems) {
      await this.receiptRepo.updateStatus(receiptId, userId, 'APPLIED');
    }

    return {
      receiptId: receipt.id,
      matchedReceiptItems,
      unmatchedReceiptItems,
    };
  }
}
