import { useState, useEffect, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import ProductSearchInput, { type GroupSelection, type FallbackSelection } from './ProductSearchInput';
import type {
  ShoppingItem,
  CreateItemPayload,
  UpdateItemPayload,
  ItemPriority,
  ChainMatch,
  ChainId,
} from '../../types';

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

const CHAIN_LABELS: Record<string, string> = {
  shufersal: 'Shufersal',
  'rami-levy': 'Rami Levy',
  'machsanei-hashuk': 'Machsanei Hashuk',
};

const CHAIN_COLORS: Record<string, string> = {
  shufersal: 'bg-red-100 text-red-700',
  'rami-levy': 'bg-blue-100 text-blue-700',
  'machsanei-hashuk': 'bg-amber-100 text-amber-700',
};

interface SelectedProduct {
  chainProductId: string;
  chainId: string;
  name: string;
  barcode?: string;
  price: number;
}

/** Flatten mapping results into a flat list with chainId attached */
function flattenMappingResults(
  results: Record<string, ChainMatch[]>,
): (ChainMatch & { chainId: string })[] {
  const flat: (ChainMatch & { chainId: string })[] = [];
  for (const [chainId, matches] of Object.entries(results)) {
    for (const m of matches) {
      flat.push({ ...m, chainId });
    }
  }
  // Sort by score desc, then price asc
  flat.sort((a, b) => b.score - a.score || a.price - b.price);
  return flat;
}

export default function ItemModal({ isOpen, onClose, onSave, item }: ItemModalProps) {
  const isEdit = Boolean(item);

  const [selection, setSelection] = useState<GroupSelection | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [fallbackProduct, setFallbackProduct] = useState<FallbackSelection | null>(null);
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
    setSelection(null);
    setSelectedProduct(null);
    setFallbackProduct(null);
    setError('');
  }, [item, isOpen]);

  const isCanonical = selection?.selectionMode === 'canonical';

  // ─── Step 1: group selected (mapping fetched) ─────────────────

  const handleGroupSelect = (sel: GroupSelection) => {
    setSelection(sel);
    setSelectedProduct(null);
    if (sel.category && !category) {
      setCategory(sel.category);
    }
    // For canonical products, set name from group immediately
    if (sel.selectionMode === 'canonical') {
      const label = sel.variantName
        ? `${sel.groupName} — ${sel.variantName}`
        : sel.groupName;
      setName(label);
    }
    setError('');
  };

  const handleFallbackSelect = (fb: FallbackSelection) => {
    setFallbackProduct(fb);
    setSelection(null);
    setSelectedProduct(null);
    setName(fb.name);
    setError('');
  };

  const handleClearGroup = () => {
    setSelection(null);
    setSelectedProduct(null);
    setFallbackProduct(null);
    setName('');
    setCategory('');
  };

  // ─── Step 2: user picks a concrete mapped product ─────────────

  const handleProductPick = (match: ChainMatch & { chainId: string }) => {
    setSelectedProduct({
      chainProductId: match.chainProductId,
      chainId: match.chainId,
      name: match.name,
      barcode: match.barcode,
      price: match.price,
    });
    setName(match.name);
    setError('');
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setName('');
  };

  // ─── Submit ────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const hasFallback = Boolean(fallbackProduct);
    if (!isEdit && !isCanonical && !hasFallback && !selectedProduct) {
      setError('Please select a specific product.');
      return;
    }
    if (!isEdit && isCanonical && !selection) {
      setError('Please select a product group.');
      return;
    }

    setLoading(true);
    try {
      const payload: CreateItemPayload = {
        name: isEdit
          ? name.trim()
          : (isCanonical || hasFallback)
            ? name.trim()
            : selectedProduct!.name,
        quantity,
        ...(category && { category: category.trim() }),
        ...(unit && { unit: unit.trim() }),
        ...(notes && { notes: notes.trim() }),
        priority,
        ...(!isEdit && hasFallback && fallbackProduct?.barcode ? { barcode: fallbackProduct.barcode } : {}),
        ...(!isEdit && !hasFallback && !isCanonical && selectedProduct?.barcode ? { barcode: selectedProduct.barcode } : {}),
        ...(!isEdit && selection ? { productGroupId: selection.groupId } : {}),
        ...(!isEdit && selection?.variantId ? { variantId: selection.variantId } : {}),
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

  // ─── Derived state ────────────────────────────────────────────

  const mappedProducts = selection ? flattenMappingResults(selection.mapping.results) : [];
  const hasMappedProducts = mappedProducts.length > 0;
  const groupLabel = selection
    ? (selection.variantName
        ? `${selection.groupName} — ${selection.variantName}`
        : selection.groupName)
    : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit item' : 'Add item'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* ─── Search / Edit name ──────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isEdit ? 'Item name' : 'Search product'} <span className="text-red-500">*</span>
          </label>
          {isEdit ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              placeholder="e.g. Olive oil"
            />
          ) : selection ? (
            /* Group is selected — show chip */
            <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-brand-200 bg-brand-50 rounded-xl text-sm">
              <span className="flex-1 font-medium text-brand-800">{groupLabel}</span>
              <span className="text-xs text-brand-400">{selection.category}</span>
              <button
                type="button"
                onClick={handleClearGroup}
                className="text-brand-400 hover:text-brand-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : fallbackProduct ? (
            /* Fallback product selected — show chip */
            <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl text-sm">
              <span className="flex-1 font-medium text-gray-800">{fallbackProduct.name}</span>
              {fallbackProduct.barcode && (
                <span className="text-xs text-gray-400 font-mono">{fallbackProduct.barcode}</span>
              )}
              <button
                type="button"
                onClick={handleClearGroup}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <ProductSearchInput
              onSelect={handleGroupSelect}
              onFallbackSelect={handleFallbackSelect}
              onClear={handleClearGroup}
            />
          )}
        </div>

        {/* ─── Step 2: mapped product picker (sku mode only) ───── */}
        {!isEdit && selection && !isCanonical && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Choose product <span className="text-red-500">*</span>
            </label>

            {selectedProduct ? (
              /* Selected product chip */
              <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-green-200 bg-green-50 rounded-xl text-sm">
                <span className="flex-1 font-medium text-green-800 truncate">
                  {selectedProduct.name}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${CHAIN_COLORS[selectedProduct.chainId] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CHAIN_LABELS[selectedProduct.chainId] ?? selectedProduct.chainId}
                </span>
                <span className="text-xs text-green-600 font-medium">
                  ₪{selectedProduct.price.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={handleClearProduct}
                  className="text-green-400 hover:text-green-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : hasMappedProducts ? (
              /* Product list */
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {mappedProducts.map((m) => (
                  <button
                    key={`${m.chainId}-${m.chainProductId}`}
                    type="button"
                    onClick={() => handleProductPick(m)}
                    className="w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                  >
                    <span className="font-medium text-gray-900 truncate flex-1">{m.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${CHAIN_COLORS[m.chainId] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CHAIN_LABELS[m.chainId] ?? m.chainId}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0 w-14 text-left">
                      ₪{m.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-400">
                No matching products found in any chain.
              </div>
            )}
          </div>
        )}

        {/* ─── Quantity / Unit ─────────────────────────────────── */}
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

        {/* ─── Category ───────────────────────────────────────── */}
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

        {/* ─── Priority ───────────────────────────────────────── */}
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

        {/* ─── Notes ──────────────────────────────────────────── */}
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

        {/* ─── Actions ────────────────────────────────────────── */}
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
            disabled={loading || (!isEdit && !isCanonical && !fallbackProduct && !selectedProduct) || (!isEdit && isCanonical && !selection)}
            className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
