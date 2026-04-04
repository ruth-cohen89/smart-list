import { useEffect, useState, useCallback } from 'react';
import { consumptionProfileService } from '../../services/consumptionProfileService';
import type { ConsumptionProfile, BaselineItem, CreateBaselineItemPayload } from '../../types';
import Layout from '../../components/Layout';
import Spinner from '../../components/Spinner';
import BaselineItemModal from './BaselineItemModal';
import OnboardingModal from './OnboardingModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(date?: string): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function frequencyLabel(days: number): string {
  if (days === 1) return 'כל יום';
  if (days === 7) return 'פעם בשבוע';
  if (days === 14) return 'כל שבועיים';
  if (days === 30) return 'פעם בחודש';
  return `כל ${days} ימים`;
}

function statusBadge(item: BaselineItem) {
  const days = daysSince(item.lastPurchasedAt);
  if (days === null) return { label: 'טרם נרכש', color: 'bg-gray-100 text-gray-500' };
  const remaining = item.intervalDays - days;
  if (remaining <= 0) return { label: 'הגיע הזמן', color: 'bg-red-100 text-red-700' };
  if (remaining <= 3)
    return { label: `בעוד ${remaining} ימים`, color: 'bg-amber-100 text-amber-700' };
  return { label: `נותרו ${remaining} ימים`, color: 'bg-brand-100 text-brand-700' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsumptionProfilePage() {
  const [profile, setProfile] = useState<ConsumptionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    consumptionProfileService
      .getProfile()
      .then(setProfile)
      .catch(() => setError('שגיאה בטעינת הנתונים.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (payload: CreateBaselineItemPayload) => {
    const updated = await consumptionProfileService.addBaselineItem(payload);
    setProfile(updated);
  };

  const handleOnboardingSuccess = (updated: ConsumptionProfile) => {
    setProfile(updated);
    setOnboardingOpen(false);
  };

  const handleDelete = async (item: BaselineItem) => {
    if (!confirm(`להסיר את "${item.name}" מהרשימה?`)) return;
    setDeleting(item.id);
    try {
      const updated = await consumptionProfileService.deleteBaselineItem(item.id);
      setProfile(updated);
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const items = profile?.baselineItems ?? [];
  const filtered = search ? items.filter((i) => i.name.includes(search)) : items;

  const sorted = [...filtered].sort((a, b) => {
    const dA = daysSince(a.lastPurchasedAt);
    const dB = daysSince(b.lastPurchasedAt);
    const remA = dA === null ? -Infinity : a.intervalDays - dA;
    const remB = dB === null ? -Infinity : b.intervalDays - dB;
    return remA - remB;
  });

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">הרגלי הקנייה שלי</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              המוצרים שאת קונה באופן קבוע — SmartList תזכיר לך מתי להתחדש
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              הוספת פריט
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-right">
            {error}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Empty state ── */}
            {items.length === 0 && (
              <div className="flex flex-col items-center py-20 text-center bg-white border border-gray-100 rounded-2xl">
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-5">
                  <svg
                    className="w-8 h-8 text-brand-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-800 font-bold text-lg">בואי נבנה לך רשימת קניות חכמה</p>
                <p className="text-gray-400 text-sm mt-2 max-w-xs leading-relaxed">
                  הוסיפי כמה מוצרים שאת קונה באופן קבוע כדי שנוכל לעזור לך להתחדש בזמן
                </p>
                <button
                  onClick={() => setOnboardingOpen(true)}
                  className="mt-6 bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  הגדרה מהירה
                </button>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  או הוסיפי פריט ידנית
                </button>
              </div>
            )}

            {/* ── Search (only when items exist) ── */}
            {items.length > 5 && (
              <div className="relative">
                <svg
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש מוצר..."
                  className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-right"
                />
              </div>
            )}

            {/* ── Item list ── */}
            {sorted.length > 0 && (
              <div className="space-y-2">
                {sorted.map((item) => {
                  const badge = statusBadge(item);
                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-gray-200 transition-colors"
                    >
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deleting === item.id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                        title="הסרה"
                      >
                        {deleting === item.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span className="font-medium text-gray-900 text-sm">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 justify-end">
                          <span className="text-xs text-gray-400">
                            {frequencyLabel(item.intervalDays)}
                          </span>
                          {item.quantity && (
                            <span className="text-xs text-gray-400">
                              · {item.quantity}
                              {item.unit ? ` ${item.unit}` : ''}
                            </span>
                          )}
                          {item.lastPurchasedAt && (
                            <span className="text-xs text-gray-400">
                              · {new Date(item.lastPurchasedAt).toLocaleDateString('he-IL')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── No search results ── */}
            {filtered.length === 0 && items.length > 0 && (
              <p className="text-center text-gray-400 text-sm py-8">
                לא נמצאו תוצאות עבור &ldquo;{search}&rdquo;
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onSuccess={handleOnboardingSuccess}
      />

      <BaselineItemModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAdd}
      />
    </Layout>
  );
}
