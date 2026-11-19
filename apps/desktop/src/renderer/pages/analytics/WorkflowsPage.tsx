import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Workflow } from "@tellann/desktop-contracts";
import { Page, useProject } from "../../pages";
import { Table } from "../../components/ui/table";
import { EmptyState } from "../../pages";
import { Workflow as WorkflowIcon } from "lucide-react";

export function WorkflowsPage() {
  const { projectId } = useProject();
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setWorkflows(null);
    window.tellann!.analytics.workflows(projectId).then(setWorkflows).catch(() => setWorkflows([]));
  }, [projectId]);

  return (
    <Page title="Workflows" description="Paths your users actually take through this application, discovered from telemetry.">
      <Table
        columns={[
          { key: "name", header: "Name", width: "1.5fr", render: (w: Workflow) => w.name },
          { key: "path", header: "Path", width: "2fr", render: (w: Workflow) => w.path.join(" → ") },
          { key: "count", header: "Executions", width: "120px", render: (w: Workflow) => w.executionCount.toLocaleString() },
          {
            key: "evidence",
            header: "",
            width: "100px",
            render: (w: Workflow) => (
              <Link className="button" to={`/applications/${projectId}/sessions?workflowName=${encodeURIComponent(w.name)}`}>
                Evidence
              </Link>
            ),
          },
        ]}
        rows={workflows ?? []}
        getKey={(w) => w.id}
        loading={workflows === null}
        empty={<EmptyState icon={<WorkflowIcon size={28} />} title="No workflows discovered yet" description="Workflows appear once Tellann observes repeated paths through your application." />}
      />
    </Page>
  );
}
