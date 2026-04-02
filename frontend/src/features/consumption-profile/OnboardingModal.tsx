import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { consumptionProfileService } from '../../services/consumptionProfileService';
import type { ConsumptionProfile } from '../../types';
import Spinner from '../../components/Spinner';

// ─── Predefined products with smart defaults ──────────────────────────────────

interface Product {
  name: string;
  intervalDays: number;
}

const PRESET_PRODUCTS: Product[] = [
  { name: 'חלב', intervalDays: 7 },
  { name: 'חלב סויה', intervalDays: 7 },
  { name: 'לחם פרוס', intervalDays: 3 },
  { name: 'ביצים', intervalDays: 5 },
  { name: 'יוגורט', intervalDays: 4 },
  { name: 'גבינה', intervalDays: 7 },
  { name: 'אורז', intervalDays: 30 },
  { name: 'פסטה', intervalDays: 21 },
  { name: 'חזה עוף', intervalDays: 7 },
  { name: 'בשר', intervalDays: 7 },
  { name: 'תפוחים', intervalDays: 7 },
  { name: 'בננות', intervalDays: 4 },
  { name: 'שוקולד', intervalDays: 10 },
  { name: 'גלידה', intervalDays: 14 },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: ConsumptionProfile) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingModal({ isOpen, onClose, onSuccess }: OnboardingModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customItems, setCustomItems] = useState<Product[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const allProducts = [...PRESET_PRODUCTS, ...customItems];

  const toggleProduct = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addCustomItem = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (allProducts.some((p) => p.name === trimmed)) {
      // already exists — just select it
      setSelected((prev) => new Set(prev).add(trimmed));
    } else {
      const newItem: Product = { name: trimmed, intervalDays: 7 };
      setCustomItems((prev) => [...prev, newItem]);
      setSelected((prev) => new Set(prev).add(trimmed));
    }
    setCustomInput('');
  };

  const handleCustomKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomItem();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) return;
    setError('');
    setLoading(true);
    try {
      const baselineItems = allProducts
        .filter((p) => selected.has(p.name))
        .map((p) => ({ name: p.name, intervalDays: p.intervalDays, quantity: 1 }));

      const profile = await consumptionProfileService.upsertFromQuestionnaire({ baselineItems });
      onSuccess(profile);
      // Reset state for next open
      setSelected(new Set());
      setCustomItems([]);
      setCustomInput('');
    } catch {
      setError('שגיאה בשמירת הנתונים. אנא נסי שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelected(new Set());
    setCustomItems([]);
    setCustomInput('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-right">
          <h2 className="text-xl font-bold text-gray-900">בוא/י נתחיל 👋</h2>
          <p className="text-gray-500 text-sm mt-1">בחר/י כמה מוצרים שאת/ה קונה בצורה שבועית</p>
          <p className="text-brand-600 text-xs mt-0.5 font-medium">זה לוקח כמה שניות</p>
        </div>

        {/* Scrollable body */}
        <div className="px-6 pb-2 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 text-right">
              {error}
            </div>
          )}

          {/* Product chips */}
          <div className="flex flex-wrap gap-2 justify-end mb-5">
            {allProducts.map((p) => {
              const isSelected = selected.has(p.name);
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => toggleProduct(p.name)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                    isSelected
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {p.name}
                </button>
              );
            })}
          </div>

          {/* Custom item input */}
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={addCustomItem}
              disabled={!customInput.trim()}
              className="flex-shrink-0 w-9 h-9 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              placeholder="הוסף מוצר משלך..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-right"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            דלג לעכשיו
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected.size === 0 || loading}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="text-white" />
                שומרת...
              </>
            ) : (
              <>
                שמירה והמשך
                {selected.size > 0 && (
                  <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selected.size}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
