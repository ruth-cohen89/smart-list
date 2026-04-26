import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { priceComparisonService } from '../../services/priceComparisonService';
import type { ComparisonResult, ChainBasket, ChainId } from '../../types';
import Layout from '../../components/Layout';
import Spinner from '../../components/Spinner';

import ramiLevyLogo from '../../assets/stores/rami-levi.png';
import shufersalLogo from '../../assets/stores/shufersal.png';
import machsaneiHashukLogo from '../../assets/stores/machsanei-hashuk.png';

// Items whose names are ambiguous — user needs to specify a variant.
const AMBIGUOUS_ITEM_SUGGESTIONS: Record<string, string> = {
  'פלפל': 'פלפל אדום / ירוק / צהוב',
};

function unitLabel(unit: string): string {
  if (unit === 'KG') return 'ק"ג';
  if (unit === 'G') return 'ג\'';
  return 'יח\'';
}

// ─── Store metadata ────────────────────────────────────────────────────────

const CHAIN_LABELS: Record<ChainId, string> = {
  shufersal: 'Shufersal',
  'rami-levy': 'Rami Levy',
  'machsanei-hashuk': 'Machsanei Hashuk',
  'tiv-taam': 'Tiv Taam',
};

const STORE_LOGOS: Partial<Record<ChainId, string>> = {
  'rami-levy': ramiLevyLogo,
  shufersal: shufersalLogo,
  'machsanei-hashuk': machsaneiHashukLogo,
};

const CHAIN_ACCENT: Record<ChainId, string> = {
  shufersal: 'bg-red-500',
  'rami-levy': 'bg-blue-500',
  'machsanei-hashuk': 'bg-amber-500',
  'tiv-taam': 'bg-green-600',
};

// ─── Logo with fallback ────────────────────────────────────────────────────

function StoreLogo({ chainId, size = 36 }: { chainId: ChainId; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = STORE_LOGOS[chainId];
  const label = CHAIN_LABELS[chainId];
  const accent = CHAIN_ACCENT[chainId];

  const isWide = chainId === 'shufersal';
  const containerW = isWide ? Math.round(size * 1.55) : size;

  if (!failed && src) {
    return (
      <div
        className="rounded-[10px] flex-shrink-0 flex items-center justify-center"
        style={{ width: containerW, height: size, background: isWide ? 'transparent' : 'white' }}
      >
        <img
          src={src}
          alt={label}
          className="block object-contain w-full h-full"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${accent} rounded-[10px] flex items-center justify-center flex-shrink-0 text-white font-bold`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {label.charAt(0)}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

type PageStatus = 'loading' | 'error' | 'ready';

export default function PriceComparisonPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const load = () => {
    setStatus('loading');
    setErrorMsg('');
    priceComparisonService
      .compareActive()
      .then((data) => {
        console.log('[PriceComparison] API response:', JSON.stringify(data, null, 2));
        setResult(data);
        setStatus('ready');
      })
      .catch((err) => {
        const msg =
          (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to compare prices. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
      });
  };

  useEffect(() => {
    load();
  }, []);

  const sortedChains = result
    ? [...result.chains].sort((a, b) => {
        if (a.isComparable !== b.isComparable) return a.isComparable ? -1 : 1;
        return a.totalPrice - b.totalPrice;
      })
    : [];

  const comparableChains = sortedChains.filter((c) => c.isComparable);
  const cheapestPrice = comparableChains.length > 0 ? comparableChains[0].totalPrice : 0;
  const mostExpensivePrice =
    comparableChains.length > 0 ? comparableChains[comparableChains.length - 1].totalPrice : 0;
  const savingsVsExpensive = mostExpensivePrice - cheapestPrice;

  return (
    <Layout>
      <div className="space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/shopping-list')}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Price Comparison</h1>
            {status === 'ready' && result && (
              <p className="text-gray-400 text-sm mt-0.5">
                Compared at {new Date(result.comparedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center py-24 text-center">
            <Spinner size="lg" />
            <p className="text-gray-500 text-sm mt-4">Comparing prices across stores...</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <svg
                className="w-7 h-7 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">{errorMsg}</p>
            <button
              onClick={load}
              className="mt-5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {status === 'ready' && result && (
          <>
            {/* ── Best basket summary ── */}
            {result.cheapestChainId && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">
                  Best basket found 🛒
                </p>
                <div className="flex items-center gap-4">
                  <StoreLogo chainId={result.cheapestChainId} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-900">
                      {CHAIN_LABELS[result.cheapestChainId]}
                    </p>
                    <p className="text-2xl font-extrabold text-green-700 tabular-nums">
                      {cheapestPrice.toFixed(2)} &#8362;
                    </p>
                  </div>
                  {savingsVsExpensive > 0.01 && comparableChains.length > 1 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">You save</p>
                      <p className="text-base font-bold text-green-600 tabular-nums">
                        {savingsVsExpensive.toFixed(2)} &#8362;
                      </p>
                      <p className="text-xs text-gray-400">
                        vs {CHAIN_LABELS[comparableChains[comparableChains.length - 1].chainId]}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Store cards ── */}
            <div className="space-y-3">
              {sortedChains.map((chain) => (
                <ChainCard
                  key={chain.chainId}
                  chain={chain}
                  isCheapest={chain.chainId === result.cheapestChainId}
                  savingsVsCheapest={chain.totalPrice - cheapestPrice}
                />
              ))}
            </div>

            {/* No matches at all */}
            {sortedChains.every((c) => (c.matchedItems ?? []).length === 0) && (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  No products could be matched to any store. Try adding items with barcodes.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ─── Chain card ────────────────────────────────────────────────────────────

function ChainCard({
  chain,
  isCheapest,
  savingsVsCheapest,
}: {
  chain: ChainBasket;
  isCheapest: boolean;
  savingsVsCheapest: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const cardClass = isCheapest
    ? 'border-green-300 bg-green-50/30 shadow-md shadow-green-100/60'
    : 'border-gray-200/70 bg-white shadow-sm hover:shadow-md hover:border-gray-300/70';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-200 ${cardClass}`}>
      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left cursor-pointer"
      >
        {/* Logo + name */}
        <StoreLogo chainId={chain.chainId} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {CHAIN_LABELS[chain.chainId]}
            </span>
            {isCheapest && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-500 text-white shadow-sm">
                Best Price
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {(chain.matchedItems ?? []).length} matched
            {(chain.unmatchedItems ?? []).length > 0 && (
              <span className="text-amber-500 ml-2">
                {(chain.unmatchedItems ?? []).length} not found
              </span>
            )}
          </p>
        </div>

        {/* Price + delta */}
        <div className="text-right flex-shrink-0">
          {(chain.matchedItems ?? []).length > 0 ? (
            <>
              <p className="text-xl font-bold text-gray-900 tabular-nums">
                {chain.totalPrice.toFixed(2)}{' '}
                <span className="text-sm font-medium text-gray-400">&#8362;</span>
              </p>
              {!chain.isComparable ? (
                <p className="text-xs font-medium text-amber-500 mt-0.5">Partial comparison</p>
              ) : (
                !isCheapest && savingsVsCheapest > 0.01 && (
                  <p className="text-xs font-medium text-red-400 tabular-nums mt-0.5">
                    +{savingsVsCheapest.toFixed(2)} &#8362;
                  </p>
                )
              )}
            </>
          ) : (
            <p className="text-sm font-medium text-gray-400">Not comparable</p>
          )}
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-300 transition-transform duration-200 flex-shrink-0 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expandable detail ── */}
      <div
        ref={contentRef}
        className="transition-all duration-200 ease-in-out overflow-hidden"
        style={{
          maxHeight: expanded ? (contentRef.current?.scrollHeight ?? 1000) : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="border-t border-gray-100/80">
          {(chain.matchedItems ?? []).length === 0 && (chain.unmatchedItems ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">
              No products could be compared for this store.
            </p>
          ) : (
            <>
              {/* Matched items */}
              {(chain.matchedItems ?? []).length > 0 && (
                <div className="divide-y divide-gray-50">
                  {(chain.matchedItems ?? []).map((item) => {
                    const hasSavings = item.regularTotalPrice > item.effectiveTotalPrice + 0.01;
                    return (
                      <div key={item.shoppingItemId} className="px-5 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {item.shoppingItemName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {item.product.originalName || item.product.normalizedName}
                            {item.itemQuantity > 1 ? ` x${item.itemQuantity}` : ''}
                          </p>
                          {item.appliedPromotion && (
                            <p className="text-xs text-green-600 truncate mt-0.5">
                              {item.appliedPromotion.description}
                            </p>
                          )}
                          {item.pricingAccuracy === 'approximate' && (
                            <p className="text-xs text-amber-500 mt-0.5">~estimated price</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900 tabular-nums">
                            {item.effectiveTotalPrice.toFixed(2)} &#8362;
                          </p>
                          <p className="text-xs text-gray-400 tabular-nums">
                            {item.effectiveUnitPrice.toFixed(2)} &#8362;/{unitLabel(item.itemUnit)}
                          </p>
                          {hasSavings && (
                            <p className="text-xs text-gray-400 line-through tabular-nums">
                              {item.regularTotalPrice.toFixed(2)} &#8362;
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unmatched items */}
              {(chain.unmatchedItems ?? []).length > 0 && (
                <div className="bg-gray-50/60 px-5 py-3">
                  <p className="text-xs font-medium text-gray-400 mb-2">Not found in this store</p>
                  <div className="space-y-1.5">
                    {(chain.unmatchedItems ?? []).map((item) => {
                      const suggestion = AMBIGUOUS_ITEM_SUGGESTIONS[item.shoppingItemName.trim()];
                      return (
                        <div key={item.shoppingItemId} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-600 truncate">{item.shoppingItemName}</p>
                            {suggestion && (
                              <p className="text-xs text-amber-600 mt-0.5">Did you mean: {suggestion}?</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 flex-shrink-0 mt-0.5">Not found</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
