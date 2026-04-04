import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { receiptService } from '../../services/receiptService';
import type { Receipt, MatchItemsResponse, MatchedReceiptItem, ConfirmMatch } from '../../types';
import Layout from '../../components/Layout';
import Spinner from '../../components/Spinner';

type Step = 'view' | 'matching' | 'confirm' | 'done';

export default function ReceiptDetailPage() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const navigate = useNavigate();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [matchResult, setMatchResult] = useState<MatchItemsResponse | null>(null);
  const [step, setStep] = useState<Step>('view');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // For confirm step: which pending matches to include
  const [selectedMatches, setSelectedMatches] = useState<
    Record<string, { sl?: string; bl?: string }>
  >({});

  useEffect(() => {
    if (!receiptId) return;
    receiptService
      .getById(receiptId)
      .then((r) => {
        setReceipt(r);
        if (r.status === 'APPLIED') setStep('done');
      })
      .catch(() => setError('Could not load receipt.'))
      .finally(() => setLoading(false));
  }, [receiptId]);

  const handleMatchItems = async () => {
    if (!receiptId) return;
    setError('');
    setActionLoading(true);
    setStep('matching');
    try {
      const result = await receiptService.matchItems(receiptId);
      setMatchResult(result);

      // Pre-select all pending matches
      const initial: Record<string, { sl?: string; bl?: string }> = {};
      result.matchedReceiptItems.forEach((m) => {
        const sl =
          m.shoppingListMatch?.status === 'pendingConfirmation'
            ? m.shoppingListMatch.itemId
            : undefined;
        const bl =
          m.baselineMatch?.status === 'pendingConfirmation' ? m.baselineMatch.itemId : undefined;
        if (sl || bl) {
          initial[m.receiptItemId] = { sl, bl };
        }
      });
      setSelectedMatches(initial);

      setStep('confirm');
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message ?? 'Matching failed.');
      } else {
        setError('Matching failed.');
      }
      setStep('view');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSlMatch = (receiptItemId: string, itemId: string) => {
    setSelectedMatches((prev) => {
      const cur = prev[receiptItemId] ?? {};
      return {
        ...prev,
        [receiptItemId]: { ...cur, sl: cur.sl === itemId ? undefined : itemId },
      };
    });
  };

  const toggleBlMatch = (receiptItemId: string, itemId: string) => {
    setSelectedMatches((prev) => {
      const cur = prev[receiptItemId] ?? {};
      return {
        ...prev,
        [receiptItemId]: { ...cur, bl: cur.bl === itemId ? undefined : itemId },
      };
    });
  };

  const handleConfirmMatches = async () => {
    if (!receiptId || !matchResult) return;
    setError('');
    setActionLoading(true);

    const matches: ConfirmMatch[] = Object.entries(selectedMatches)
      .filter(([, v]) => v.sl || v.bl)
      .map(([receiptItemId, v]) => ({
        receiptItemId,
        ...(v.sl && { shoppingListItemId: v.sl }),
        ...(v.bl && { baselineItemId: v.bl }),
      }));

    if (matches.length === 0) {
      // Nothing to confirm — just mark as done
      setStep('done');
      setActionLoading(false);
      return;
    }

    try {
      await receiptService.confirmMatches(receiptId, { matches });
      setStep('done');
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message ?? 'Confirmation failed.');
      } else {
        setError('Confirmation failed.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!receipt) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-500">Receipt not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/receipts')}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Receipt</h1>
            <p className="text-gray-500 text-sm">
              {new Date(receipt.uploadedAt).toLocaleDateString(undefined, {
                dateStyle: 'long',
              })}
            </p>
          </div>
          <span
            className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${
              receipt.status === 'APPLIED'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {receipt.status}
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-green-900 mb-2">Receipt applied!</h2>
            <p className="text-green-700 text-sm mb-6">
              Your shopping list and baseline have been updated.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/shopping-list')}
                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                View shopping list
              </button>
              <button
                onClick={() => navigate('/receipts')}
                className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Upload another
              </button>
            </div>
          </div>
        )}

        {/* Step: View (SCANNED receipt, before matching) */}
        {step === 'view' && (
          <>
            <ScannedItemsCard items={receipt.items} />
            <button
              onClick={handleMatchItems}
              disabled={actionLoading || receipt.items.length === 0}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Matching items…
                </>
              ) : (
                'Match items against my lists'
              )}
            </button>
          </>
        )}

        {/* Step: Matching (spinner between requests) */}
        {step === 'matching' && (
          <div className="flex flex-col items-center py-16 gap-4">
            <Spinner size="lg" />
            <p className="text-gray-500 text-sm">Matching items…</p>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && matchResult && (
          <ConfirmStep
            matchResult={matchResult}
            selectedMatches={selectedMatches}
            onToggleSl={toggleSlMatch}
            onToggleBl={toggleBlMatch}
            onConfirm={handleConfirmMatches}
            loading={actionLoading}
          />
        )}
      </div>
    </Layout>
  );
}

function ScannedItemsCard({ items }: { items: Receipt['items'] }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-900">
          Scanned items
          <span className="ml-2 text-sm font-normal text-gray-400">({items.length})</span>
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-gray-400 text-sm">
          No items were detected in this receipt.
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                {item.category && <p className="text-xs text-gray-400">{item.category}</p>}
              </div>
              <div className="flex-shrink-0 text-right">
                {item.price != null && (
                  <p className="text-sm font-semibold text-gray-700">₪{item.price.toFixed(2)}</p>
                )}
                {item.quantity != null && <p className="text-xs text-gray-400">×{item.quantity}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmStep({
  matchResult,
  selectedMatches,
  onToggleSl,
  onToggleBl,
  onConfirm,
  loading,
}: {
  matchResult: MatchItemsResponse;
  selectedMatches: Record<string, { sl?: string; bl?: string }>;
  onToggleSl: (id: string, itemId: string) => void;
  onToggleBl: (id: string, itemId: string) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const { matchedReceiptItems, unmatchedReceiptItems } = matchResult;

  const autoApproved = matchedReceiptItems.filter(
    (m) =>
      m.shoppingListMatch?.status === 'autoApproved' || m.baselineMatch?.status === 'autoApproved',
  );

  const pending = matchedReceiptItems.filter(
    (m) =>
      m.shoppingListMatch?.status === 'pendingConfirmation' ||
      m.baselineMatch?.status === 'pendingConfirmation',
  );

  const pendingCount = Object.values(selectedMatches).filter((v) => v.sl || v.bl).length;

  return (
    <div className="space-y-5">
      {/* Auto-approved */}
      {autoApproved.length > 0 && (
        <Section
          title="Auto-approved"
          badge={`${autoApproved.length}`}
          badgeColor="bg-green-100 text-green-700"
          description="These were matched confidently and already applied."
        >
          {autoApproved.map((m) => (
            <MatchRow key={m.receiptItemId} item={m} readOnly />
          ))}
        </Section>
      )}

      {/* Pending confirmation */}
      {pending.length > 0 && (
        <Section
          title="Needs your review"
          badge={`${pending.length}`}
          badgeColor="bg-amber-100 text-amber-700"
          description="Check the matches below. Uncheck any that are incorrect."
        >
          {pending.map((m) => {
            const sel = selectedMatches[m.receiptItemId] ?? {};
            return (
              <PendingMatchRow
                key={m.receiptItemId}
                item={m}
                slSelected={!!sel.sl}
                blSelected={!!sel.bl}
                onToggleSl={() =>
                  m.shoppingListMatch && onToggleSl(m.receiptItemId, m.shoppingListMatch.itemId)
                }
                onToggleBl={() =>
                  m.baselineMatch && onToggleBl(m.receiptItemId, m.baselineMatch.itemId)
                }
              />
            );
          })}
        </Section>
      )}

      {/* Unmatched */}
      {unmatchedReceiptItems.length > 0 && (
        <Section
          title="No matches found"
          badge={`${unmatchedReceiptItems.length}`}
          badgeColor="bg-gray-100 text-gray-500"
          description="These items were not found in your shopping list or baseline."
        >
          {unmatchedReceiptItems.map((u) => (
            <div key={u.receiptItemId} className="px-4 py-3 flex items-center gap-3">
              <span className="text-sm text-gray-500">{u.receiptItemName}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Spinner size="sm" className="text-white" />
            Confirming…
          </>
        ) : pendingCount > 0 ? (
          `Confirm ${pendingCount} match${pendingCount !== 1 ? 'es' : ''}`
        ) : (
          'Done (no pending matches to confirm)'
        )}
      </button>
    </div>
  );
}

function Section({
  title,
  badge,
  badgeColor,
  description,
  children,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
            {badge}
          </span>
        </div>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function MatchRow({ item, readOnly }: { item: MatchedReceiptItem; readOnly?: boolean }) {
  const sl = item.shoppingListMatch;
  const bl = item.baselineMatch;
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      {readOnly && (
        <div className="mt-0.5 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <svg
            className="w-3 h-3 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{item.receiptItemName}</p>
        <div className="mt-1 space-y-0.5">
          {sl && (
            <p className="text-xs text-gray-500">
              List: <span className="font-medium text-gray-700">{sl.itemName}</span>
              <span className="text-gray-400 ml-1">({Math.round(sl.score * 100)}%)</span>
            </p>
          )}
          {bl && (
            <p className="text-xs text-gray-500">
              Baseline: <span className="font-medium text-gray-700">{bl.itemName}</span>
              <span className="text-gray-400 ml-1">({Math.round(bl.score * 100)}%)</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingMatchRow({
  item,
  slSelected,
  blSelected,
  onToggleSl,
  onToggleBl,
}: {
  item: MatchedReceiptItem;
  slSelected: boolean;
  blSelected: boolean;
  onToggleSl: () => void;
  onToggleBl: () => void;
}) {
  const sl =
    item.shoppingListMatch?.status === 'pendingConfirmation' ? item.shoppingListMatch : null;
  const bl = item.baselineMatch?.status === 'pendingConfirmation' ? item.baselineMatch : null;

  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold text-gray-900 mb-2">{item.receiptItemName}</p>
      <div className="space-y-2">
        {sl && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={slSelected}
              onChange={onToggleSl}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Shopping list: <span className="font-medium">{sl.itemName}</span>
              </span>
              <span className="ml-2 text-xs text-gray-400">
                {Math.round(sl.score * 100)}% match
              </span>
            </div>
          </label>
        )}
        {bl && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={blSelected}
              onChange={onToggleBl}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <div className="flex-1">
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Baseline: <span className="font-medium">{bl.itemName}</span>
              </span>
              <span className="ml-2 text-xs text-gray-400">
                {Math.round(bl.score * 100)}% match
              </span>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
