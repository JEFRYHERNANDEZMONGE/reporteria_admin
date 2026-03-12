"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type SearchableComboboxProps<TItem> = {
  items: TItem[];
  getItemId: (item: TItem) => string | number;
  getItemLabel: (item: TItem) => string;
  getItemKeywords?: (item: TItem) => string;
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  className?: string;
  listClassName?: string;
  inputClassName?: string;
  onSelect: (item: TItem) => void;
};

export function SearchableCombobox<TItem>({
  items,
  getItemId,
  getItemLabel,
  getItemKeywords,
  placeholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  loading = false,
  error = null,
  disabled = false,
  className,
  listClassName,
  inputClassName,
  onSelect,
}: SearchableComboboxProps<TItem>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return [];

    return items.filter((item) => {
      const label = getItemLabel(item).toLowerCase();
      const keywords = (getItemKeywords?.(item) ?? "").toLowerCase();
      return label.includes(normalizedQuery) || keywords.includes(normalizedQuery);
    });
  }, [getItemKeywords, getItemLabel, items, normalizedQuery]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const shouldShowList = open && !disabled && normalizedQuery.length > 0;

  const handleSelect = (item: TItem) => {
    onSelect(item);
    setQuery("");
    setOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={rootRef} className={className}>
      <div
        className={`flex h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3 ${
          disabled ? "opacity-70" : ""
        }`}
      >
        <span className="text-[14px] text-[#405C62]">⌕</span>
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (normalizedQuery) {
              setOpen(true);
              setHighlightedIndex(0);
            }
          }}
          onKeyDown={(event) => {
            if (!shouldShowList || filteredItems.length === 0) return;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((prev) =>
                prev < filteredItems.length - 1 ? prev + 1 : 0
              );
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : filteredItems.length - 1
              );
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const selected = filteredItems[highlightedIndex] ?? filteredItems[0];
              if (selected) {
                handleSelect(selected);
              }
            }

            if (event.key === "Escape") {
              setOpen(false);
              setHighlightedIndex(-1);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-transparent text-[13px] text-[var(--muted)] outline-none placeholder:text-[#8A9BA7] ${
            inputClassName ?? ""
          }`}
          aria-controls={listId}
          aria-expanded={shouldShowList}
          role="combobox"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setHighlightedIndex(-1);
            }}
            className="text-[16px] leading-none text-[#8A9BA7] hover:text-[#405C62]"
            aria-label="Limpiar búsqueda"
          >
            ×
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-1 text-[12px] text-[#9B1C1C]">{error}</p> : null}

      {shouldShowList ? (
        <div
          className={`mt-1 max-h-48 overflow-y-auto rounded-[8px] border border-[var(--border)] bg-white shadow-md ${
            listClassName ?? ""
          }`}
          role="listbox"
          id={listId}
        >
          {loading ? (
            <p className="px-3 py-2 text-[13px] text-[var(--muted)]">Cargando...</p>
          ) : filteredItems.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-[var(--muted)]">{emptyMessage}</p>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={getItemId(item)}
                type="button"
                onClick={() => handleSelect(item)}
                className={`flex w-full items-center border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[#F8FAF8] ${
                  index === highlightedIndex ? "bg-[#F8FAF8]" : ""
                }`}
                role="option"
                aria-selected={index === highlightedIndex}
              >
                <span className="text-[13px] text-foreground">{getItemLabel(item)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
