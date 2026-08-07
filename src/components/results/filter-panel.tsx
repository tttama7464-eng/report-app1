"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { AGE_GROUPS, COUNTRIES, CREATIVE_FIELDS, GENDERS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ResultFilters } from "@/lib/types";

interface FilterPanelProps {
  filters: ResultFilters;
  onChange: (filters: ResultFilters) => void;
  open: boolean;
  onToggle: () => void;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground hover:bg-surface"
      )}
    >
      {children}
    </button>
  );
}

export function FilterPanel({ filters, onChange, open, onToggle }: FilterPanelProps) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            onClick={() => onChange({})}
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-5 rounded-2xl border border-border bg-surface/60 p-4 animate-fade-up">
          <FilterGroup label="Country">
            {COUNTRIES.map((c) => (
              <Chip
                key={c}
                active={filters.country === c}
                onClick={() => onChange({ ...filters, country: filters.country === c ? undefined : c })}
              >
                {c}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Age group">
            {AGE_GROUPS.map((a) => (
              <Chip
                key={a.value}
                active={filters.ageGroup === a.value}
                onClick={() =>
                  onChange({ ...filters, ageGroup: filters.ageGroup === a.value ? undefined : a.value })
                }
              >
                {a.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Gender">
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                active={filters.gender === g.value}
                onClick={() =>
                  onChange({ ...filters, gender: filters.gender === g.value ? undefined : g.value })
                }
              >
                {g.label}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Creative field">
            {CREATIVE_FIELDS.map((f) => (
              <Chip
                key={f.value}
                active={filters.creativeField === f.value}
                onClick={() =>
                  onChange({
                    ...filters,
                    creativeField: filters.creativeField === f.value ? undefined : f.value,
                  })
                }
              >
                {f.label}
              </Chip>
            ))}
          </FilterGroup>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Occupation
            </p>
            <input
              value={filters.occupation ?? ""}
              onChange={(e) => onChange({ ...filters, occupation: e.target.value || undefined })}
              placeholder="e.g. Designer"
              className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
