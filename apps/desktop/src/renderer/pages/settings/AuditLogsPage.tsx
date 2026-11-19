import { useEffect, useState } from "react";
import type { AuditLogEntry, AuditLogPage } from "@tellann/desktop-contracts";
import { Page, LoadingState, EmptyState } from "../../pages";
import { Table, TablePager } from "../../components/ui/table";
import { formatEnum } from "../../components/desktop-ui";
import { useActiveOrganization } from "./use-active-organization";
import { OrganizationSwitcher } from "./organization-switcher";
import { ScrollText } from "lucide-react";

const PAGE_SIZE = 25;

export function AuditLogsPage() {
  const { organizationId, organizations, setOrganizationId } = useActiveOrganization();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<AuditLogPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    setResult(null);
    setError(null);
    window.tellann!.org
      .auditLogs(organizationId, { page, limit: PAGE_SIZE, q: q.trim() || undefined })
      .then(setResult)
      .catch((err) => {
        const message = String((err as Error)?.message ?? err);
        setError(message.includes("FEATURE_NOT_ENTITLED") ? "FEATURE_NOT_ENTITLED" : message);
      });
  }, [organizationId, page, q]);

  if (error === "FEATURE_NOT_ENTITLED") {
    return (
      <Page title="Audit Logs" description="A record of security and administrative activity in this organization.">
        <section className="guarded-card">
          <ScrollText size={32} />
          <div>
            <h2>Not included on this plan</h2>
            <p>Audit log history is available on the Business and Enterprise plans.</p>
          </div>
        </section>
      </Page>
    );
  }

  return (
    <Page
      title="Audit Logs"
      description="A record of security and administrative activity in this organization."
      toolbar={<OrganizationSwitcher organizations={organizations} organizationId={organizationId} onChange={setOrganizationId} />}
      actions={
        <input
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
          style={{ minWidth: 200 }}
        />
      }
    >
      {error && error !== "FEATURE_NOT_ENTITLED" ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <Table
        columns={[
          { key: "action", header: "Action", width: "1.5fr", render: (row: AuditLogEntry) => formatEnum(row.action) },
          {
            key: "actor",
            header: "Actor",
            width: "1.5fr",
            render: (row: AuditLogEntry) => row.user?.displayName ?? row.user?.email ?? row.userId ?? "System",
          },
          { key: "ip", header: "IP Address", width: "140px", render: (row: AuditLogEntry) => row.ipAddress ?? "—" },
          { key: "when", header: "When", width: "180px", render: (row: AuditLogEntry) => new Date(row.createdAt).toLocaleString() },
        ]}
        rows={result?.data ?? []}
        getKey={(row) => row.id}
        loading={result === null}
        empty={<EmptyState icon={<ScrollText size={28} />} title="No activity yet" description="Audit events will appear here as they happen." />}
        footer={
          result ? (
            <TablePager page={result.page} pageCount={Math.max(1, Math.ceil(result.total / result.limit))} onPageChange={setPage} />
          ) : null
        }
      />
    </Page>
  );
}
