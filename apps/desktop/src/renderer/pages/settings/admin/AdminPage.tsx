import { Page } from "../../../pages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { useDesktop } from "../../../desktop-context";
import { AiUsageTab } from "./AiUsageTab";
import { RulesetsTab } from "./RulesetsTab";
import { RuleCandidatesTab } from "./RuleCandidatesTab";
import { JobMonitorTab } from "./JobMonitorTab";
import { AdminAuditLogsTab } from "./AdminAuditLogsTab";
import { ShieldAlert } from "lucide-react";

export function AdminPage() {
  const { session } = useDesktop();

  if (!session?.isSystemAdmin) {
    return (
      <Page title="Admin" description="System-wide governance — visible only to Tellann system administrators.">
        <section className="guarded-card">
          <ShieldAlert size={32} />
          <div>
            <h2>Access denied</h2>
            <p>This area is restricted to system administrators.</p>
          </div>
        </section>
      </Page>
    );
  }

  return (
    <Page title="Admin" description="System-wide governance — visible only to Tellann system administrators.">
      <Tabs defaultValue="ai-usage">
        <TabsList>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
          <TabsTrigger value="jobs">Job Monitor</TabsTrigger>
          <TabsTrigger value="rulesets">Rulesets</TabsTrigger>
          <TabsTrigger value="rule-candidates">Rule Candidates</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="ai-usage">
          <AiUsageTab />
        </TabsContent>
        <TabsContent value="jobs">
          <JobMonitorTab />
        </TabsContent>
        <TabsContent value="rulesets">
          <RulesetsTab />
        </TabsContent>
        <TabsContent value="rule-candidates">
          <RuleCandidatesTab />
        </TabsContent>
        <TabsContent value="audit-logs">
          <AdminAuditLogsTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
