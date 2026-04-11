import { useState, useEffect, useRef, useCallback } from 'react';
import { productService } from '../../services/productService';
import type { ProductSearchResult } from '../../types';
import Spinner from '../../components/Spinner';

function ProductThumb({ imageUrl, size = 28 }: { imageUrl?: string; size?: number }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className="rounded object-cover flex-shrink-0 bg-gray-100"
        onError={(e) => {
          // On load failure, replace with placeholder
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }
  return (
    <div
      className="rounded bg-gray-100 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        className="text-gray-300"
        width={size * 0.6}
        height={size * 0.6}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
        />
      </svg>
    </div>
  );
}

interface ProductSearchInputProps {
  onSelect: (product: ProductSearchResult) => void;
  selectedProduct: ProductSearchResult | null;
  onClear: () => void;
}

export default function ProductSearchInput({
  onSelect,
  selectedProduct,
  onClear,
}: ProductSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await productService.search(q.trim());
        setResults(data.results);
        setOpen(data.results.length > 0 || q.trim().length >= 2);
        setActiveIndex(-1);
      } catch {
        setResults([]);
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

  const handleChange = (value: string) => {
    setQuery(value);
    doSearch(value);
  };

  const handleSelect = (product: ProductSearchResult) => {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // If a product is already selected, show it as a chip
  if (selectedProduct) {
    return (
      <div className="flex items-center gap-2 w-full px-4 py-2.5 border border-brand-200 bg-brand-50 rounded-xl text-sm">
        <ProductThumb imageUrl={selectedProduct.imageUrl} size={24} />
        <span className="flex-1 font-medium text-brand-800">{selectedProduct.name}</span>
        <span className="text-xs text-brand-400">{selectedProduct.barcode}</span>
        <button
          type="button"
          onClick={onClear}
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

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm pr-10"
          placeholder="Search for a product..."
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.length === 0 && !loading && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-400">No results found</div>
          )}
          {results.map((product, index) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className={`w-full text-right px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors flex items-center gap-2 ${
                index === activeIndex ? 'bg-brand-50' : ''
              } ${index === 0 ? 'rounded-t-xl' : ''} ${index === results.length - 1 ? 'rounded-b-xl' : ''}`}
            >
              <ProductThumb imageUrl={product.imageUrl} size={28} />
              <span className="font-medium text-gray-900 truncate flex-1">{product.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{product.barcode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
