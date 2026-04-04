import { useState, useEffect, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import type { ShoppingItem, CreateItemPayload, UpdateItemPayload, ItemPriority } from '../../types';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateItemPayload | UpdateItemPayload) => Promise<void>;
  item?: ShoppingItem;
}

const PRIORITIES: { value: ItemPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function ItemModal({ isOpen, onClose, onSave, item }: ItemModalProps) {
  const isEdit = Boolean(item);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<ItemPriority>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity);
      setCategory(item.category ?? '');
      setUnit(item.unit ?? '');
      setNotes(item.notes ?? '');
      setPriority(item.priority ?? 'medium');
    } else {
      setName('');
      setQuantity(1);
      setCategory('');
      setUnit('');
      setNotes('');
      setPriority('medium');
    }
    setError('');
  }, [item, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: CreateItemPayload = {
        name: name.trim(),
        quantity,
        ...(category && { category: category.trim() }),
        ...(unit && { unit: unit.trim() }),
        ...(notes && { notes: notes.trim() }),
        priority,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message ?? 'Failed to save item.');
      } else {
        setError('Failed to save item.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit item' : 'Add item'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Item name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            placeholder="e.g. Olive oil"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="kg, pcs…"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={40}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            placeholder="Dairy, Produce…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  priority === p.value
                    ? p.value === 'high'
                      ? 'bg-red-500 border-red-500 text-white'
                      : p.value === 'medium'
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-gray-400 border-gray-400 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={200}
            rows={2}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
            placeholder="Optional notes…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
