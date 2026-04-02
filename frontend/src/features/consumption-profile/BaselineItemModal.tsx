import { useState, useEffect, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import type { CreateBaselineItemPayload } from '../../types';

interface BaselineItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateBaselineItemPayload) => Promise<void>;
}

function frequencyHint(days: number | ''): string {
  if (days === '') return '';
  if (days === 1) return 'כל יום';
  if (days === 7) return 'פעם בשבוע';
  if (days === 14) return 'כל שבועיים';
  if (days === 30) return 'פעם בחודש';
  return `כל ${days} ימים`;
}

export default function BaselineItemModal({ isOpen, onClose, onSave }: BaselineItemModalProps) {
  const [name, setName] = useState('');
  const [intervalDays, setIntervalDays] = useState<number | ''>(7);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setIntervalDays(7);
    setQuantity('');
    setUnit('');
    setError('');
  }, [isOpen]);

  const intervalInvalid = intervalDays !== '' && (intervalDays < 1 || intervalDays > 365);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('שם המוצר הוא שדה חובה.');
      return;
    }
    if (intervalDays === '' || intervalInvalid) {
      setError('יש להזין מספר ימים בין 1 ל-365.');
      return;
    }
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        intervalDays: intervalDays as number,
        ...(quantity !== '' && { quantity: Number(quantity) }),
        ...(unit && { unit: unit.trim() }),
      });
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message ?? 'שגיאה בהוספת הפריט.');
      } else {
        setError('שגיאה בהוספת הפריט.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="הוספת פריט">
      <div dir="rtl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-right">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 text-right">
              שם המוצר <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-right"
              placeholder="לדוגמה: חלב"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 text-right">
              תדירות רכישה <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 flex-row-reverse">
              <input
                type="number"
                value={intervalDays}
                onChange={(e) => {
                  const val = e.target.value;
                  setIntervalDays(val === '' ? '' : parseInt(val, 10));
                }}
                min={1}
                max={365}
                required
                className={`w-24 px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-center ${
                  intervalInvalid ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              />
              <span className="text-sm text-gray-400">ימים</span>
            </div>
            {!intervalInvalid && intervalDays !== '' && (
              <p className="mt-1.5 text-xs text-brand-600 text-right">
                {frequencyHint(intervalDays)}
              </p>
            )}
            {intervalInvalid && (
              <p className="mt-1.5 text-xs text-red-500 text-right">יש להזין מספר בין 1 ל-365.</p>
            )}
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 text-right">
                יחידה
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-right"
                placeholder="ק״ג, יח׳..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 text-right">
                כמות רגילה
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1),
                  )
                }
                min={1}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-center"
                placeholder="1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {loading ? 'שומרת...' : 'הוספה'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
