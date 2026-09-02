// CSV export: hit the backend export endpoint with the table's CURRENT query string so
// the download matches exactly what the operator is looking at. A temporary anchor keeps
// the session cookie (same-origin request) and lets Content-Disposition drive the save.
export function downloadCsv(resource: string, queryString: string): void {
  const params = new URLSearchParams(queryString);
  // Paging is irrelevant to an export — the endpoint returns every matching row.
  params.delete("page");
  params.delete("page_size");

  const anchor = document.createElement("a");
  anchor.href = `/api/${resource}/export?${params.toString()}`;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
