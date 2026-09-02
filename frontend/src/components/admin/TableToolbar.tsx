// Table toolbar: search + filter controls + right-aligned utilities, matching the
// enterprise reference layout (search right of the title row, filters on the left).
import type { ReactNode } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  testid: string;
  className?: string;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  testid,
  className,
}: FilterSelectProps) {
  const labels: Record<string, string> = {};
  options.forEach((o) => {
    labels[o.value] = o.label;
  });
  return (
    <Select value={value || "all"} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        data-testid={testid}
        className={cn("h-8 min-w-[9.5rem] bg-white text-xs", className)}
      >
        <SelectValue>{(v) => labels[v as string] ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface TableToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  activeFilterCount?: number;
  onReset?: () => void;
  onRefresh?: () => void;
  right?: ReactNode;
  testid: string;
}

export function TableToolbar({
  search,
  onSearch,
  searchPlaceholder = "Search records",
  filters,
  activeFilterCount = 0,
  onReset,
  onRefresh,
  right,
  testid,
}: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={searchPlaceholder}
            data-testid={`${testid}-search-input`}
            className="h-8 w-64 bg-white pl-8 text-xs transition-shadow duration-150 focus-visible:shadow-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              data-testid={`${testid}-search-clear`}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 transition-colors duration-150 hover:text-slate-700"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="hidden items-center gap-1.5 text-[11px] font-medium text-slate-500 lg:flex">
          <SlidersHorizontal className="size-3.5" />
          {activeFilterCount > 0 ? (
            <span data-testid={`${testid}-filter-count`}>
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied
            </span>
          ) : (
            <span data-testid={`${testid}-filter-count`}>No filters applied</span>
          )}
        </div>

        {filters}

        {onReset && activeFilterCount > 0 ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={onReset}
            data-testid={`${testid}-reset-filters`}
            className="text-slate-500"
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh ? (
          <Button
            variant="outline"
            size="xs"
            onClick={onRefresh}
            data-testid={`${testid}-refresh`}
            className="bg-white"
          >
            <RotateCcw className="size-3.5" /> Refresh
          </Button>
        ) : null}
        {right}
      </div>
    </div>
  );
}
