"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection, UpgradeNotice } from "@/components/settings/settings-page";
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (query) params.set("q", query);
    const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/audit-logs?${params}`);
    if (response.status === 403) {
      setLocked(true);
      return;
    }
    if (!response.ok) throw new Error("Unable to load audit logs.");
    const body = await response.json();
    setEntries(body.data ?? []);
    setTotal(body.total ?? 0);
    setLocked(false);
  }, [page, query, selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  return (
    <SettingsPage title="Audit Logs" description="Review organisation-scoped security, access, billing, key, and governance activity." scope="ORGANIZATION">
      {locked ? <UpgradeNotice>Standard audit history is available on Business and Enterprise plans.</UpgradeNotice> : (
        <SettingsSection title="Audit history" description={`${total} recorded events`}>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search action or metadata" className="mb-4 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white" />
          <div className="divide-y divide-neutral-800">
            {entries.length === 0 ? <p className="py-8 text-center text-sm text-neutral-500">No events match this view.</p> : entries.map((entry) => (
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
            <Button variant="secondary" size="sm" disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
