import { useEffect, useState } from "react";
import type { Ruleset } from "@tellann/desktop-contracts";
import { Table } from "../../../components/ui/table";
import { Status } from "../../../pages";

export function RulesetsTab() {
  const [rulesets, setRulesets] = useState<Ruleset[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    window.tellann!.admin.rulesets().then(setRulesets).catch(() => setRulesets([]));
  };

  useEffect(load, []);

  const promote = async (id: string) => {
    setBusyId(id);
    try {
      await window.tellann!.admin.promoteRuleset(id);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Table
        columns={[
          { key: "version", header: "Version", width: "80px", render: (row: Ruleset) => `v${row.version}` },
          { key: "status", header: "Status", width: "120px", render: (row: Ruleset) => <Status>{row.status}</Status> },
          { key: "created", header: "Created", width: "180px", render: (row: Ruleset) => new Date(row.createdAt).toLocaleString() },
          {
            key: "actions",
            header: "",
            width: "120px",
            render: (row: Ruleset) =>
              row.status === "DRAFT" ? (
                <button type="button" className="button primary" onClick={() => promote(row.id)} disabled={busyId === row.id}>
                  Promote
                </button>
              ) : null,
          },
        ]}
        rows={rulesets ?? []}
        getKey={(row) => row.id}
        loading={rulesets === null}
      />
    </div>
  );
}
