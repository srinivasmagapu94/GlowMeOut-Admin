// Enterprise data grid: sortable headers, zebra rows, bulk selection, numbered pagination.
// Presentational and fully controlled — every page owns its query state via useTableState.
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Inbox,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtNumber } from "@/lib/format";
import type { SortDir } from "@/lib/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  headClassName?: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  testid: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
  onSort: (field: string) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRowClick?: (row: T) => void;
  activeRowId?: string;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  bulkActions?: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  density?: "compact" | "standard";
}

const PAGE_SIZES = [10, 25, 50, 100];

function pageWindow(page: number, pages: number): number[] {
  const span = 5;
  let start = Math.max(1, page - Math.floor(span / 2));
  const end = Math.min(pages, start + span - 1);
  start = Math.max(1, end - span + 1);
  const out: number[] = [];
  for (let i = start; i <= end; i += 1) out.push(i);
  return out;
}

export function DataTable<T>({
  testid,
  columns,
  rows,
  getRowId,
  total,
  page,
  pages,
  pageSize,
  sort,
  dir,
  onSort,
  onPage,
  onPageSize,
  isLoading,
  isError,
  onRowClick,
  activeRowId,
  selectable = false,
  selected = [],
  onSelectedChange,
  bulkActions,
  emptyTitle = "No records match the current filters",
  emptyHint = "Adjust the search term or clear the filters to widen the result set.",
  density = "standard",
}: DataTableProps<T>) {
  const rowIds = rows.map(getRowId);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.includes(id));
  const someSelected = rowIds.some((id) => selected.includes(id)) && !allSelected;
  const cellPad = density === "compact" ? "px-3 py-1.5" : "px-3 py-2.5";
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const toggleAll = () => {
    if (!onSelectedChange) return;
    onSelectedChange(allSelected ? selected.filter((id) => !rowIds.includes(id)) : Array.from(new Set([...selected, ...rowIds])));
  };

  const toggleOne = (id: string) => {
    if (!onSelectedChange) return;
    onSelectedChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <div className="relative" data-testid={`${testid}-wrapper`}>
      <div className="scroll-slim overflow-x-auto border-y border-grid">
        <table className="w-full min-w-max border-collapse text-sm" data-testid={testid}>
          <thead>
            <tr className="bg-slate-100/90">
              {selectable ? (
                <th scope="col" className="w-10 border-b border-slate-300 px-3 py-2.5 text-center">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows on this page"
                    data-testid={`${testid}-select-all-checkbox`}
                  />
                </th>
              ) : null}
              {columns.map((col) => {
                const active = sort === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "border-b border-slate-300 px-3 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-slate-600 uppercase select-none",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.align !== "right" && col.align !== "center" && "text-left",
                      col.headClassName,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        data-testid={`${testid}-sort-${col.key}`}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded transition-colors duration-150 hover:text-primary",
                          col.align === "right" && "flex-row-reverse",
                          active && "text-primary",
                        )}
                      >
                        {col.header}
                        {active ? (
                          dir === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-slate-400" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading && rows.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className={i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}>
                    {selectable ? <td className={cellPad} /> : null}
                    {columns.map((col) => (
                      <td key={col.key} className={cellPad}>
                        <span className="animate-sheen block h-3 w-full max-w-[160px] rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}

            {rows.map((row, index) => {
              const id = getRowId(row);
              const isSelected = selected.includes(id);
              const isActive = activeRowId === id;
              return (
                <tr
                  key={id}
                  data-testid={`${testid}-row-${id}`}
                  data-selected={isSelected ? "true" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-grid/70 transition-colors duration-150",
                    index % 2 === 1 ? "bg-slate-50/40" : "bg-white",
                    onRowClick && "cursor-pointer",
                    "hover:bg-slate-100/80",
                    (isSelected || isActive) &&
                      "bg-row-selected font-medium text-slate-900 hover:bg-row-selected",
                  )}
                >
                  {selectable ? (
                    <td
                      className={cn(cellPad, "text-center align-middle")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Select row ${id}`}
                        data-testid={`${testid}-select-${id}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        cellPad,
                        "align-middle text-slate-700",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}

            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-6 py-16">
                  <div
                    className="mx-auto flex max-w-md flex-col items-center gap-2 text-center"
                    data-testid={`${testid}-empty-state`}
                  >
                    {isError ? (
                      <TriangleAlert className="size-7 text-amber-500" />
                    ) : (
                      <Inbox className="size-7 text-slate-400" />
                    )}
                    <p className="text-sm font-semibold text-slate-700">
                      {isError ? "This table could not be loaded" : emptyTitle}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isError
                        ? "The operations API is unreachable right now. Retry once the connection is restored."
                        : emptyHint}
                    </p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span data-testid={`${testid}-range`}>
            Showing <span className="num font-semibold text-slate-800">{fmtNumber(from)}</span>–
            <span className="num font-semibold text-slate-800">{fmtNumber(to)}</span> of{" "}
            <span className="num font-semibold text-slate-800">{fmtNumber(total)}</span>
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <label htmlFor={`${testid}-page-size`} className="text-slate-500">
              Rows
            </label>
            <select
              id={`${testid}-page-size`}
              data-testid={`${testid}-page-size`}
              value={pageSize}
              onChange={(event) => onPageSize(Number(event.target.value))}
              className="h-7 rounded border border-input bg-white px-1.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:border-primary/50 focus:ring-2 focus:ring-ring/40 focus:outline-none"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={page <= 1}
            onClick={() => onPage(1)}
            data-testid={`${testid}-page-first`}
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            data-testid={`${testid}-page-prev`}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          {pageWindow(page, pages).map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              size="xs"
              onClick={() => onPage(p)}
              data-testid={`${testid}-page-${p}`}
              className={cn("num min-w-7", p === page && "pointer-events-none")}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            data-testid={`${testid}-page-next`}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={page >= pages}
            onClick={() => onPage(pages)}
            data-testid={`${testid}-page-last`}
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>

      {selectable && selected.length > 0 ? (
        <div className="pointer-events-none sticky bottom-4 z-20 flex justify-center px-4">
          <div
            className="animate-bulk-in pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur"
            data-testid={`${testid}-bulk-bar`}
          >
            <span className="num px-1.5 font-semibold" data-testid={`${testid}-bulk-count`}>
              {selected.length} selected
            </span>
            <span className="h-4 w-px bg-slate-600" />
            {bulkActions}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onSelectedChange?.([])}
              data-testid={`${testid}-bulk-clear`}
              className="text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
