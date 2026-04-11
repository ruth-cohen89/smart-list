import { useState, useEffect, useRef, useCallback } from 'react';
import { productGroupService } from '../../services/productGroupService';
import type {
  ProductGroupResult,
  ProductVariantResult,
  GroupMappingResult,
} from '../../types';
import Spinner from '../../components/Spinner';

// ─── Selection value passed up to ItemModal ─────────────────────────────────

export interface GroupSelection {
  groupId: string;
  groupName: string;
  category: string;
  variantId?: string;
  variantName?: string;
  mapping: GroupMappingResult;
}

interface ProductSearchInputProps {
  onSelect: (selection: GroupSelection) => void;
  selection: GroupSelection | null;
  onClear: () => void;
}

export default function ProductSearchInput({
  onSelect,
  selection,
  onClear,
}: ProductSearchInputProps) {
  // ─── Search state ───────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<ProductGroupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // ─── Variant picker state ───────────────────────────────────────
  const [pickedGroup, setPickedGroup] = useState<ProductGroupResult | null>(null);
  const [variants, setVariants] = useState<ProductVariantResult[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // ─── Mapping state ──────────────────────────────────────────────
  const [loadingMapping, setLoadingMapping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Debounced search ───────────────────────────────────────────

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setGroups([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await productGroupService.searchGroups(q.trim());
        setGroups(data.results);
        setOpen(data.results.length > 0 || q.trim().length >= 2);
        setActiveIndex(-1);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Group selected → fetch variants ────────────────────────────

  const handleGroupSelect = async (group: ProductGroupResult) => {
    setQuery('');
    setGroups([]);
    setOpen(false);

    setPickedGroup(group);
    setLoadingVariants(true);
    try {
      const data = await productGroupService.getVariants(group.id);
      if (data.variants.length > 0) {
        setVariants(data.variants);
        // Wait for user to pick a variant
      } else {
        // No variants — go straight to mapping
        await finishSelection(group);
      }
    } catch {
      // Fallback: proceed without variants
      await finishSelection(group);
    } finally {
      setLoadingVariants(false);
    }
  };

  // ─── Variant selected ──────────────────────────────────────────

  const handleVariantSelect = async (variant: ProductVariantResult) => {
    if (!pickedGroup) return;
    setVariants([]);
    await finishSelection(pickedGroup, variant);
  };

  // Skip variants — user wants no specific variant
  const handleSkipVariants = async () => {
    if (!pickedGroup) return;
    setVariants([]);
    await finishSelection(pickedGroup);
  };

  // ─── Run mapping and emit result ───────────────────────────────

  const finishSelection = async (
    group: ProductGroupResult,
    variant?: ProductVariantResult,
  ) => {
    setLoadingMapping(true);
    try {
      const mapping = await productGroupService.mapGroup(group.id, variant?.id);
      onSelect({
        groupId: group.id,
        groupName: group.name,
        category: group.category,
        variantId: variant?.id,
        variantName: variant?.name,
        mapping,
      });
    } catch {
      // Still emit selection even if mapping fails
      onSelect({
        groupId: group.id,
        groupName: group.name,
        category: group.category,
        variantId: variant?.id,
        variantName: variant?.name,
        mapping: {
          group: { id: group.id, name: group.name, category: group.category },
          results: {},
        },
      });
    } finally {
      setLoadingMapping(false);
      setPickedGroup(null);
    }
  };

  // ─── Clear everything ──────────────────────────────────────────

  const handleClear = () => {
    setPickedGroup(null);
    setVariants([]);
    setQuery('');
    onClear();
  };

  // ─── Keyboard navigation ──────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || groups.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < groups.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : groups.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < groups.length) {
        handleGroupSelect(groups[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ─── Render: already selected ──────────────────────────────────

  if (selection) {
    const label = selection.variantName
      ? `${selection.groupName} — ${selection.variantName}`
      : selection.groupName;

    return (
      <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-brand-200 bg-brand-50 rounded-xl text-sm">
        <span className="flex-1 font-medium text-brand-800">{label}</span>
        <span className="text-xs text-brand-400">{selection.category}</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-brand-400 hover:text-brand-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    );
  }

  // ─── Render: loading mapping ───────────────────────────────────

  if (loadingMapping) {
    return (
      <div className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-500">
        <Spinner size="sm" />
        <span>Finding best products…</span>
      </div>
    );
  }

  // ─── Render: variant picker ────────────────────────────────────

  if (pickedGroup && (loadingVariants || variants.length > 0)) {
    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{pickedGroup.name}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Change
          </button>
        </div>
        {loadingVariants ? (
          <div className="flex items-center justify-center px-4 py-3">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={handleSkipVariants}
              className="w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors text-gray-500"
            >
              Any variant
            </button>
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleVariantSelect(v)}
                className="w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors font-medium text-gray-900"
              >
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: search input ──────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            doSearch(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (groups.length > 0) setOpen(true);
          }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm pr-10"
          placeholder="Search for a product…"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {groups.length === 0 && !loading && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-400">No results found</div>
          )}
          {groups.map((group, index) => (
            <button
              key={group.id}
              type="button"
              onClick={() => handleGroupSelect(group)}
              className={`w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-center gap-2 ${
                index === activeIndex ? 'bg-brand-50' : ''
              } ${index === 0 ? 'rounded-t-xl' : ''} ${index === groups.length - 1 ? 'rounded-b-xl' : ''}`}
            >
              <span className="font-medium text-gray-900 truncate flex-1">{group.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{group.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
