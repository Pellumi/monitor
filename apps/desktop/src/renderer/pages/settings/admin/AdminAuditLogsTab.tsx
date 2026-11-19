import { useEffect, useState } from "react";
import type { AuditLogEntry, AuditLogPage } from "@tellann/desktop-contracts";
import { Table, TablePager } from "../../../components/ui/table";
import { formatEnum } from "../../../components/desktop-ui";

const PAGE_SIZE = 25;

export function AdminAuditLogsTab() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditLogPage | null>(null);

  useEffect(() => {
    setResult(null);
    window.tellann!.admin.auditLogs({ page, limit: PAGE_SIZE }).then(setResult).catch(() => setResult({ data: [], total: 0, page: 1, limit: PAGE_SIZE }));
  }, [page]);

  return (
    <div style={{ marginTop: 12 }}>
      <Table
        columns={[
          { key: "action", header: "Action", width: "1.5fr", render: (row: AuditLogEntry) => formatEnum(row.action) },
          { key: "actor", header: "Actor", width: "1.5fr", render: (row: AuditLogEntry) => row.user?.email ?? row.userId ?? "System" },
          { key: "org", header: "Organization", width: "1fr", render: (row: AuditLogEntry) => row.organizationId ?? "—" },
          { key: "when", header: "When", width: "180px", render: (row: AuditLogEntry) => new Date(row.createdAt).toLocaleString() },
        ]}
        rows={result?.data ?? []}
        getKey={(row) => row.id}
        loading={result === null}
        footer={result ? <TablePager page={result.page} pageCount={Math.max(1, Math.ceil(result.total / result.limit))} onPageChange={setPage} /> : null}
      />
    </div>
  );
}
