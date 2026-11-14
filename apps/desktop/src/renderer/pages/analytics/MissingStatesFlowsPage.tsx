import { useEffect, useState } from "react";
import { Page, useProject, LoadingState, EmptyState } from "../../pages";
import { Table } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { AlertTriangle } from "lucide-react";

type MissingState = { stateName: string; confidence: number; reason: string };
type MissingFlow = { path: string[]; confidence: number; reason: string };

export function MissingStatesFlowsPage() {
  const { projectId } = useProject();
  const [report, setReport] = useState<{ missingStates: MissingState[]; missingFlows: MissingFlow[] } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setReport(null);
    window.tellann!.analytics
      .latestReport(projectId)
      .then((data) => setReport({ missingStates: (data as any).missingStates ?? [], missingFlows: (data as any).missingFlows ?? [] }))
      .catch(() => setReport({ missingStates: [], missingFlows: [] }));
  }, [projectId]);

  if (!report) return <LoadingState />;

  return (
    <Page title="Missing States & Flows" description="Confidence-scored gaps between what's declared and what your users actually do.">
      <Tabs defaultValue="states">
        <TabsList>
          <TabsTrigger value="states">Missing States ({report.missingStates.length})</TabsTrigger>
          <TabsTrigger value="flows">Missing Flows ({report.missingFlows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="states">
          <Table
            columns={[
              { key: "state", header: "State", width: "2fr", render: (row: MissingState) => row.stateName },
              { key: "confidence", header: "Confidence", width: "120px", render: (row: MissingState) => `${Math.round(row.confidence * 100)}%` },
              { key: "reason", header: "Reason", width: "2fr", render: (row: MissingState) => row.reason },
            ]}
            rows={report.missingStates}
            getKey={(row) => row.stateName}
            empty={<EmptyState icon={<AlertTriangle size={28} />} title="No missing states" description="Everything observed is already declared." />}
          />
        </TabsContent>
        <TabsContent value="flows">
          <Table
            columns={[
              { key: "path", header: "Path", width: "2fr", render: (row: MissingFlow) => row.path.join(" → ") },
              { key: "confidence", header: "Confidence", width: "120px", render: (row: MissingFlow) => `${Math.round(row.confidence * 100)}%` },
              { key: "reason", header: "Reason", width: "2fr", render: (row: MissingFlow) => row.reason },
            ]}
            rows={report.missingFlows}
            getKey={(row) => row.path.join("/")}
            empty={<EmptyState icon={<AlertTriangle size={28} />} title="No missing flows" description="Everything observed is already declared." />}
          />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
