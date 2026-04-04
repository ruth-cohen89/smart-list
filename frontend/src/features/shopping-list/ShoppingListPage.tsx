import { useEffect, useState, useCallback } from 'react';
import { shoppingListService } from '../../services/shoppingListService';
import type {
  ShoppingList,
  ShoppingItem,
  SoonSuggestion,
  CreateItemPayload,
  UpdateItemPayload,
} from '../../types';
import Layout from '../../components/Layout';
import Spinner from '../../components/Spinner';
import ItemModal from './ItemModal';

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-500 border-gray-200',
};

// Classify axios errors so we can distinguish empty-list from real failures
function isNetworkOrServerError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const status = (err as { response?: { status?: number } }).response?.status;
  // No response at all = network error; 5xx = server error
  if (status === undefined) return true;
  if (status >= 500) return true;
  return false;
}

export default function ShoppingListPage() {
  const [list, setList] = useState<ShoppingList | null>(null);
  const [suggestions, setSuggestions] = useState<SoonSuggestion[]>([]);

  // Three exclusive states: 'loading' | 'error' | 'ready'
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShoppingItem | undefined>(undefined);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    shoppingListService
      .getActiveList()
      .then((data) => {
        setList(data.activeList);
        setSuggestions(data.soonSuggestions);
        setStatus('ready');
      })
      .catch((err) => {
        // 404 means "no active list created yet" — treat as empty, not error
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          setList(null);
          setStatus('ready');
        } else if (isNetworkOrServerError(err)) {
          setStatus('error');
        } else {
          // 4xx other than 404 — still show empty rather than confusing error
          setList(null);
          setStatus('ready');
        }
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditItem(undefined);
    setModalOpen(true);
  };

  const openEdit = (item: ShoppingItem) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const handleSave = async (payload: CreateItemPayload | UpdateItemPayload) => {
    if (editItem) {
      const updated = await shoppingListService.updateItem(editItem.id, payload);
      setList(updated);
    } else {
      const updated = await shoppingListService.addItem(payload as CreateItemPayload);
      setList(updated);
      setStatus('ready');
    }
  };

  const handlePurchase = async (item: ShoppingItem) => {
    setPurchasing(item.id);
    try {
      const updated = await shoppingListService.purchaseItem(item.id);
      setList(updated);
    } catch {
      // silent — item stays in list if purchase fails
    } finally {
      setPurchasing(null);
    }
  };

  const handleDelete = async (item: ShoppingItem) => {
    if (!confirm(`Remove "${item.name}" from your list?`)) return;
    setDeleting(item.id);
    try {
      const updated = await shoppingListService.deleteItem(item.id);
      setList(updated);
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  const handleAddSuggestion = async (name: string) => {
    const updated = await shoppingListService.addItem({ name, quantity: 1 });
    setList(updated);
    setSuggestions((prev) => prev.filter((s) => s.name !== name));
  };

  // Group items by category
  const grouped = list
    ? list.items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
        const cat = item.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {})
    : {};

  const isEmpty = status === 'ready' && (!list || list.items.length === 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shopping List</h1>
            {status === 'ready' && list && list.items.length > 0 && (
              <p className="text-gray-400 text-sm mt-0.5">
                {list.items.length} item{list.items.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {!isEmpty && status !== 'error' && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
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
              Add item
            </button>
          )}
        </div>

        {/* ── Loading ── */}
        {status === 'loading' && (
          <div className="flex justify-center py-24">
            <Spinner size="lg" />
          </div>
        )}

        {/* ── Error ── */}
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
            <p className="text-gray-700 font-medium">Couldn&apos;t load your list</p>
            <p className="text-gray-400 text-sm mt-1">Check your connection and try again.</p>
            <button
              onClick={load}
              className="mt-5 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Ready ── */}
        {status === 'ready' && (
          <>
            {/* Soon suggestions */}
            {suggestions.length > 0 && (
              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-brand-800 mb-3 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-brand-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Coming up soon
                </h2>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => handleAddSuggestion(s.name)}
                      className="flex items-center gap-1.5 bg-white border border-brand-200 text-brand-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-100 transition-colors"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {s.name}
                      <span className="text-brand-400 ml-0.5">({s.daysUntilDue}d)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {isEmpty && (
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
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-800 font-semibold text-base">Your shopping list is empty</p>
                <p className="text-gray-400 text-sm mt-1.5 max-w-xs">
                  Looks like you haven&apos;t added anything yet. Start by adding your first item.
                </p>
                <button
                  onClick={openAdd}
                  className="mt-6 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Add your first item
                </button>
              </div>
            )}

            {/* ── Items by category ── */}
            {!isEmpty &&
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onPurchase={handlePurchase}
                        onDelete={handleDelete}
                        isPurchasing={purchasing === item.id}
                        isDeleting={deleting === item.id}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>

      <ItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        item={editItem}
      />
    </Layout>
  );
}

function ItemCard({
  item,
  onEdit,
  onPurchase,
  onDelete,
  isPurchasing,
  isDeleting,
}: {
  item: ShoppingItem;
  onEdit: (item: ShoppingItem) => void;
  onPurchase: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  isPurchasing: boolean;
  isDeleting: boolean;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-gray-200 transition-colors">
      {/* Purchase button */}
      <button
        onClick={() => onPurchase(item)}
        disabled={isPurchasing}
        title="Mark as purchased"
        className="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded-full hover:border-brand-500 hover:bg-brand-50 transition-colors flex items-center justify-center group/check"
      >
        {isPurchasing ? (
          <Spinner size="sm" />
        ) : (
          <svg
            className="w-3 h-3 text-transparent group-hover/check:text-brand-500 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{item.name}</span>
          {item.priority && item.priority !== 'medium' && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-md border ${PRIORITY_COLORS[item.priority]}`}
            >
              {item.priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">
            {item.quantity}
            {item.unit ? ` ${item.unit}` : ''}
          </span>
          {item.notes && <span className="text-xs text-gray-400 truncate">· {item.notes}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          onClick={() => onDelete(item)}
          disabled={isDeleting}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          {isDeleting ? (
            <Spinner size="sm" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
