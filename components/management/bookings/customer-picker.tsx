"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchCustomers, type CustomerOption } from "@/lib/actions/customer-lookup";

const inputCls =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

export const customerName = (c: CustomerOption) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;

// Searchable customer field. Submits the chosen id as `customer_id`.
export function CustomerPicker({
  value, onChange, invalid,
}: {
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const listId = useId();

  useEffect(() => {
    if (value || query.trim().length < 2) { setResults([]); return; }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchCustomers(query);
      if (id !== reqId.current) return; // a newer search superseded this one
      setLoading(false);
      if (res.error) { setError(res.error); setResults([]); return; }
      setError(null);
      setResults(res.results ?? []);
      setActive(0);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [query, value]);

  const choose = (c: CustomerOption) => { onChange(c); setOpen(false); setQuery(""); };

  if (value) {
    return (
      <div className={`flex items-center justify-between gap-3 ${inputCls} ${invalid ? "border-red-500" : ""}`} data-testid="customer-picked">
        <input type="hidden" name="customer_id" value={value.id} />
        <span className="truncate">
          <span className="font-medium">{customerName(value)}</span>
          <span className="text-text-muted-wabs"> · {value.email}</span>
          {value.flagged && <span className="ml-2 text-xs text-red-700">⚑ flagged</span>}
          {!value.is_active && <span className="ml-2 text-xs text-gray-600">inactive</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-gold hover:underline shrink-0">Change</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search name, email or phone…"
        className={`${inputCls} ${invalid ? "border-red-500" : ""}`}
        data-testid="customer-search"
      />
      {/* Required-field guard: browsers block submit until a customer is chosen. */}
      <input tabIndex={-1} aria-hidden required value="" onChange={() => {}} className="absolute inset-0 opacity-0 pointer-events-none" name="customer_id" />
      {open && query.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-72 overflow-auto">
          {loading && results.length === 0 && <li className="px-3 py-2 text-sm text-text-muted-wabs">Searching…</li>}
          {!loading && results.length === 0 && !error && <li className="px-3 py-2 text-sm text-text-muted-wabs">No customers match.</li>}
          {error && <li className="px-3 py-2 text-sm text-red-600">{error}</li>}
          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); choose(c); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-sm cursor-pointer ${i === active ? "bg-gold/15" : ""}`}
            >
              <span className="text-navy font-medium">{customerName(c)}</span>
              <span className="text-text-muted-wabs"> · {c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
              {c.flagged && <span className="ml-2 text-xs text-red-700">⚑</span>}
              {!c.is_active && <span className="ml-2 text-xs text-gray-600">inactive</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-text-muted-wabs mt-1">Type at least 2 characters.</p>
    </div>
  );
}
