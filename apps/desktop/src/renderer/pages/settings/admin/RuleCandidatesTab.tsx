import { useEffect, useState } from "react";
import type { RuleCandidate } from "@tellann/desktop-contracts";
import { Table } from "../../../components/ui/table";
import { Status } from "../../../pages";

export function RuleCandidatesTab() {
  const [candidates, setCandidates] = useState<RuleCandidate[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    window.tellann!.admin.ruleCandidates({ status: "PENDING_REVIEW", limit: 50 }).then((result) => setCandidates(result.data)).catch(() => setCandidates([]));
  };

  useEffect(load, []);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      await (action === "approve" ? window.tellann!.admin.approveCandidate(id) : window.tellann!.admin.rejectCandidate(id));
      setCandidates((current) => current?.filter((c) => c.id !== id) ?? current);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Table
        columns={[
          { key: "summary", header: "Candidate", width: "2fr", render: (row: RuleCandidate) => row.summary ?? row.id },
          { key: "status", header: "Status", width: "140px", render: (row: RuleCandidate) => <Status>{row.status}</Status> },
          { key: "created", header: "Created", width: "180px", render: (row: RuleCandidate) => new Date(row.createdAt).toLocaleString() },
          {
            key: "actions",
            header: "",
            width: "180px",
            render: (row: RuleCandidate) => (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="button primary" onClick={() => act(row.id, "approve")} disabled={busyId === row.id}>
                  Approve
                </button>
                <button type="button" className="button danger" onClick={() => act(row.id, "reject")} disabled={busyId === row.id}>
                  Reject
                </button>
              </div>
            ),
          },
        ]}
        rows={candidates ?? []}
        getKey={(row) => row.id}
        loading={candidates === null}
      />
    </div>
  );
}
