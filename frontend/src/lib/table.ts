// Shared list-table state: search, filters, sort, pagination, bulk selection.
// One hook per management page keeps every table on the same query contract.
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { Facets, PageResult } from "@/lib/types";

export type SortDir = "asc" | "desc";

export interface TableState {
  q: string;
  setQ: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  sort: string;
  dir: SortDir;
  toggleSort: (field: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  queryString: string;
  queryKeyPart: Record<string, unknown>;
}

export function useTableState(defaultSort: string, defaultDir: SortDir = "desc"): TableState {
  const [q, setQRaw] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState<SortDir>(defaultDir);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);

  const setQ = useCallback((value: string) => {
    setQRaw(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
    setQRaw("");
    setPage(1);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (field: string) => {
      if (field === sort) {
        setDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSort(field);
        setDir("asc");
      }
      setPage(1);
    },
    [sort],
  );

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v && v !== "all").length + (q ? 1 : 0),
    [filters, q],
  );

  const { queryString, queryKeyPart } = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    params.set("sort", sort);
    params.set("dir", dir);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    return {
      queryString: params.toString(),
      queryKeyPart: { q: q.trim(), filters, sort, dir, page, pageSize },
    };
  }, [q, filters, sort, dir, page, pageSize]);

  return {
    q,
    setQ,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    sort,
    dir,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    selected,
    setSelected,
    queryString,
    queryKeyPart,
  };
}

export function useResourceList<T>(resource: string, state: TableState) {
  return useQuery({
    queryKey: [resource, "list", state.queryKeyPart],
    queryFn: () => apiGet<PageResult<T>>(`/${resource}?${state.queryString}`),
    placeholderData: (prev) => prev,
  });
}

export function useFacets(resource: string) {
  return useQuery({
    queryKey: [resource, "facets"],
    queryFn: () => apiGet<Facets>(`/${resource}/facets`),
    staleTime: 5 * 60 * 1000,
  });
}

export function facetOptions(
  values: (string | number | boolean)[] | undefined,
  allLabel: string,
  labelFor: (value: string) => string,
): { value: string; label: string }[] {
  const options = (values ?? []).map((v) => ({ value: String(v), label: labelFor(String(v)) }));
  return [{ value: "all", label: allLabel }, ...options];
}
