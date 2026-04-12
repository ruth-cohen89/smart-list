import { useState, useEffect, useRef, useCallback } from 'react';
import { productGroupService } from '../../services/productGroupService';
import { productService } from '../../services/productService';
import type {
  ProductGroupResult,
  ProductVariantResult,
  ProductSearchResult,
  GroupMappingResult,
  SelectionMode,
} from '../../types';
import Spinner from '../../components/Spinner';

// ─── Selection value passed up to ItemModal ─────────────────────────────────

export interface GroupSelection {
  groupId: string;
  groupName: string;
  category: string;
  selectionMode: SelectionMode;
  variantId?: string;
  variantName?: string;
  mapping: GroupMappingResult;
}

export interface FallbackSelection {
  name: string;
  barcode?: string;
}

interface ProductSearchInputProps {
  onSelect: (selection: GroupSelection) => void;
  onFallbackSelect?: (selection: FallbackSelection) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function ProductSearchInput({
  onSelect,
  onFallbackSelect,
  onClear,
  disabled,
}: ProductSearchInputProps) {
  // ─── Search state ───────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<ProductGroupResult[]>([]);
  const [fallbackResults, setFallbackResults] = useState<ProductSearchResult[]>([]);
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
      setFallbackResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await productGroupService.searchGroups(q.trim());
        setGroups(data.results);
        // Fallback: if no groups found, try raw product search
        if (data.results.length === 0 && onFallbackSelect) {
          try {
            const fallback = await productService.search(q.trim());
            setFallbackResults(fallback.results);
          } catch {
            setFallbackResults([]);
          }
        } else {
          setFallbackResults([]);
        }
        setOpen(q.trim().length >= 2);
        setActiveIndex(-1);
      } catch {
        setGroups([]);
        setFallbackResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [onFallbackSelect]);

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
      } else {
        await finishSelection(group);
      }
    } catch {
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
        selectionMode: group.selectionMode,
        variantId: variant?.id,
        variantName: variant?.name,
        mapping,
      });
    } catch {
      onSelect({
        groupId: group.id,
        groupName: group.name,
        category: group.category,
        selectionMode: group.selectionMode,
        variantId: variant?.id,
        variantName: variant?.name,
        mapping: {
          group: { id: group.id, name: group.name, department: group.department, category: group.category, selectionMode: group.selectionMode },
          results: {},
        },
      });
    } finally {
      setLoadingMapping(false);
      setPickedGroup(null);
    }
  };

  // ─── Fallback product selected ──────────────────────────────────

  const handleFallbackSelect = (product: ProductSearchResult) => {
    setQuery('');
    setGroups([]);
    setFallbackResults([]);
    setOpen(false);
    onFallbackSelect?.({ name: product.name, barcode: product.barcode });
  };

  // ─── Clear everything ──────────────────────────────────────────

  const handleClear = () => {
    setPickedGroup(null);
    setVariants([]);
    setFallbackResults([]);
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

  // ─── Render: loading mapping ───────────────────────────────────

  if (loadingMapping) {
    return (
      <div className="flex items-center justify-center gap-2 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-500">
        <Spinner size="sm" />
        <span>Finding products…</span>
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
          disabled={disabled}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm pr-10 disabled:bg-gray-50 disabled:text-gray-400"
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
          {groups.map((group, index) => (
            <button
              key={group.id}
              type="button"
              onClick={() => handleGroupSelect(group)}
              className={`w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-center gap-2 ${
                index === activeIndex ? 'bg-brand-50' : ''
              } ${index === 0 ? 'rounded-t-xl' : ''} ${index === groups.length - 1 && fallbackResults.length === 0 ? 'rounded-b-xl' : ''}`}
            >
              <span className="font-medium text-gray-900 truncate flex-1">{group.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{group.category}</span>
            </button>
          ))}
          {/* Fallback: raw product results when no groups match */}
          {groups.length === 0 && fallbackResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                Products
              </div>
              {fallbackResults.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleFallbackSelect(product)}
                  className="w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-center gap-2"
                >
                  <span className="font-medium text-gray-900 truncate flex-1">{product.name}</span>
                  {product.barcode && (
                    <span className="text-xs text-gray-400 flex-shrink-0 font-mono">{product.barcode}</span>
                  )}
                </button>
              ))}
            </>
          )}
          {groups.length === 0 && fallbackResults.length === 0 && !loading && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-400">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
