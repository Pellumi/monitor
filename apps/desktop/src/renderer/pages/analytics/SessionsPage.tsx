import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Page, useProject, EmptyState } from "../../pages";
import { Table } from "../../components/ui/table";
import { Status } from "../../pages";
import { Video } from "lucide-react";

type SessionRow = {
  id: string;
  startTime: string;
  durationMs: number;
  eventCount: number;
  errorCount: number;
  endUserLabel: string | null;
  deviceType: string | null;
  browserName: string | null;
  abandoned: boolean;
};

export function SessionsPage() {
  const { projectId } = useProject();
  const [searchParams] = useSearchParams();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setSessions(null);
    const filters: Record<string, string> = {};
    const workflowName = searchParams.get("workflowName");
    if (workflowName) filters.workflowName = workflowName;
    window.tellann!.sessions
      .list(projectId, filters)
      .then((result) => setSessions((result.sessions as unknown as SessionRow[]) ?? []))
      .catch(() => setSessions([]));
  }, [projectId, searchParams]);

  return (
    <Page title="Sessions" description="Every observed session, with errors, device, and replay where recorded.">
      <Table
        columns={[
          {
            key: "when",
            header: "Started",
            width: "1.2fr",
            render: (row: SessionRow) => <Link to={`/applications/${projectId}/sessions/${row.id}`}>{new Date(row.startTime).toLocaleString()}</Link>,
          },
          { key: "user", header: "User", width: "1.2fr", render: (row: SessionRow) => row.endUserLabel ?? "Anonymous" },
          { key: "duration", header: "Duration", width: "100px", render: (row: SessionRow) => `${Math.round(row.durationMs / 1000)}s` },
          { key: "events", header: "Events", width: "90px", render: (row: SessionRow) => row.eventCount },
          {
            key: "status",
            header: "Status",
            width: "120px",
            render: (row: SessionRow) =>
              row.errorCount ? <Status>Errors</Status> : row.abandoned ? <Status>Abandoned</Status> : <Status>Complete</Status>,
          },
          { key: "device", header: "Device", width: "160px", render: (row: SessionRow) => [row.browserName, row.deviceType].filter(Boolean).join(" · ") || "—" },
        ]}
        rows={sessions ?? []}
        getKey={(row) => row.id}
        loading={sessions === null}
        empty={<EmptyState icon={<Video size={28} />} title="No sessions yet" description="Sessions appear here once your SDK starts sending telemetry." />}
      />
    </Page>
  );
}
