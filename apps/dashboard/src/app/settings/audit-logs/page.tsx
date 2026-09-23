"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection, UpgradeNotice } from "@/components/settings/settings-page";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  ipAddress?: string | null;
  metadata?: unknown;
  user?: { email?: string; displayName?: string | null } | null;
};

export default function AuditLogsPage() {
  const { selectedOrgId } = useSession();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const { preferences } = usePreferences();
  const pageSize = preferences.tablePageSize;
  const invalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
  const filtersActive = Boolean(query.trim() || fromDate || toDate);

  const dateParams = useMemo(() => {
    if (invalidDateRange) return null;
    return {
      from: fromDate ? new Date(`${fromDate}T00:00:00.000`).toISOString() : "",
      to: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : "",
    };
  }, [fromDate, invalidDateRange, toDate]);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    if (!dateParams) {
      requestSequence.current += 1;
      setLoading(false);
      return;
    }
    const requestId = ++requestSequence.current;
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (query.trim()) params.set("q", query.trim());
    if (dateParams.from) params.set("from", dateParams.from);
    if (dateParams.to) params.set("to", dateParams.to);
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/audit-logs?${params}`);
      if (response.status === 403) {
        if (requestId === requestSequence.current) setLocked(true);
        return;
      }
      if (!response.ok) throw new Error("Unable to load audit logs.");
      const body = await response.json();
      if (requestId !== requestSequence.current) return;
      setEntries(body.data ?? []);
      setTotal(body.total ?? 0);
      setLocked(false);
    } catch (loadError) {
      if (requestId === requestSequence.current) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load audit logs.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [dateParams, page, pageSize, query, selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const clearFilters = () => {
    setQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  return (
    <SettingsPage title="Audit Logs" description="Review organisation-scoped security, access, billing, key, and governance activity." scope="ORGANIZATION">
      {locked ? <UpgradeNotice>Standard audit history is available on Business and Enterprise plans.</UpgradeNotice> : (
        <SettingsSection title="Audit history" description={filtersActive ? `${total} matching events` : `${total} recorded events`}>
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_minmax(9rem,12rem)_minmax(9rem,12rem)_auto]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-400">Search</span>
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                  placeholder="Action, actor, IP, or metadata"
                  className="h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />From</span>
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => { setFromDate(event.target.value); setPage(1); }}
                className="h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />To</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => { setToDate(event.target.value); setPage(1); }}
                className="h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none"
              />
            </label>
            <Button className="h-10 self-end" variant="secondary" size="sm" disabled={!filtersActive} onClick={clearFilters}>
              <X aria-hidden="true" className="h-4 w-4" /> Clear
            </Button>
          </div>
          {invalidDateRange ? <p role="alert" className="mb-4 text-sm text-red-400">The start date must be before the end date.</p> : null}
          {error ? <p role="alert" className="mb-4 text-sm text-red-400">{error}</p> : null}
          <div className="divide-y divide-neutral-800">
            {loading ? <p className="py-8 text-center text-sm text-neutral-500">Loading audit events…</p> : entries.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">No events match these filters.</p> : entries.map((entry) => (
              <details key={entry.id} className="py-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-neutral-200">{entry.action.replaceAll("_", " ")}</span>
                    <time className="text-xs text-neutral-500">{new Date(entry.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{entry.user?.displayName ?? entry.user?.email ?? "System"}{entry.ipAddress ? ` · ${entry.ipAddress}` : ""}</p>
                </summary>
                <pre className="mt-3 overflow-auto rounded-md bg-black p-3 text-xs text-neutral-400">{JSON.stringify(entry.metadata ?? {}, null, 2)}</pre>
              </details>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span className="text-xs text-neutral-500">Page {page}</span>
            <Button variant="secondary" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
