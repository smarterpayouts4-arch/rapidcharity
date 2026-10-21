import { useId, useMemo, useState } from "react";
import type { CatalogValue } from "@/types/application";
import { catalogFromOther, catalogFromSelection, emptyCatalogValue } from "@/lib/catalog/catalogValue";
import { searchCatalog, type CatalogItem } from "@/lib/catalog/search";

type Props<T extends CatalogItem> = {
  id: string;
  label: string;
  kind: "institutions" | "programs" | "cities";
  items: T[];
  value: unknown;
  onChange: (next: CatalogValue, item: T | null) => void;
  filter?: { levelCode?: string; type?: string[] };
  manualLabel: string;
  error?: string;
  required?: boolean;
};

function asValue(v: unknown): CatalogValue {
  return v && typeof v === "object" && "source" in v ? (v as CatalogValue) : emptyCatalogValue();
}

/** Type-ahead over a local catalog with a manual fallback that is queued for staff review. */
export function CatalogField<T extends CatalogItem>({ id, label, kind, items, value, onChange, filter, manualLabel, error, required = true }: Props<T>) {
  const current = asValue(value);
  const listId = useId();
  const [query, setQuery] = useState(current.source === "catalog" ? current.labelSnapshot ?? "" : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(current.source === "other" && current.rawText !== "");

  const hits = useMemo(() => (open ? searchCatalog(query, items, kind, filter ?? {}) : []), [open, query, items, kind, filter]);

  function pick(item: T) {
    setQuery(item.label);
    setOpen(false);
    setManual(false);
    onChange(catalogFromSelection(item, query), item);
  }

  function describe(item: CatalogItem) {
    return [item.label, item.city, item.province].filter(Boolean).join(", ");
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {!manual ? (
        <div className="combo">
          <input
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            value={query}
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={hits.length ? `${listId}-${active}` : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
              if (current.id) onChange(emptyCatalogValue(), null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (!hits.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(hits[active]!.item as T);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {hits.length > 0 ? (
            <ul className="suggestion-list" role="listbox" id={listId} aria-label={`${label} suggestions`}>
              {hits.map(({ item }, i) => (
                <li
                  key={item.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(item as T);
                  }}
                >
                  {describe(item)}
                </li>
              ))}
            </ul>
          ) : null}
          {open && query.trim().length >= 2 && hits.length === 0 ? <p className="hint">No match in the list.</p> : null}
        </div>
      ) : (
        <input
          id={id}
          type="text"
          maxLength={120}
          value={current.rawText}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-manual-note`}
          onChange={(e) => onChange(catalogFromOther(e.target.value), null)}
        />
      )}
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setManual((m) => !m);
          setQuery("");
          onChange(emptyCatalogValue(), null);
        }}
      >
        {manual ? "Search the list instead" : manualLabel}
      </button>
      {manual ? (
        <p className="hint" id={`${id}-manual-note`}>
          RAPID staff will check what you type.
        </p>
      ) : null}
      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
