"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import {
  PermissionNotice,
  SettingsPage,
  SettingsSection,
  UpgradeNotice,
} from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";

type Token = {
  id: string;
  label?: string | null;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
};

export default function IntegrationsPage() {
  const { selectedOrgId, memberships } = useSession();
  const role = memberships.find((m) => m.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const [tokens, setTokens] = useState<Token[]>([]);
  const [locked, setLocked] = useState(false);
  const [revealed, setRevealed] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    const response = await authenticatedFetch(
      `/api-gateway/organizations/${selectedOrgId}/programmatic-tokens`,
    );
    if (response.status === 403) {
      setLocked(true);
      return;
    }
    if (!response.ok) throw new Error("Unable to load management API tokens.");
    setTokens(await response.json());
    setLocked(false);
  }, [selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createToken() {
    if (!selectedOrgId || !canManage) return;
    setError("");
    const response = await authenticatedFetch(
      `/api-gateway/organizations/${selectedOrgId}/programmatic-tokens`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "Dashboard token",
          scopes: ["applications:read", "reports:read"],
        }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.message || body.error || "Unable to create token.");
      return;
    }
    setRevealed(body.rawToken);
    await load();
  }

  return (
    <SettingsPage
      title="Integrations"
      description="Manage management-plane tokens and outbound delivery endpoints separately from ingestion keys."
      scope="ORGANIZATION"
    >
      <SettingsSection
        title="Management API tokens"
        description="Scoped credentials for Tellann management APIs."
      >
        {locked ? (
          <UpgradeNotice>
            Management API access is available on Business and Enterprise plans.
          </UpgradeNotice>
        ) : (
          <>
            {!canManage ? (
              <div className="mb-4">
                <PermissionNotice>
                  You can view these tokens, but only an Owner or Admin can create
                  or revoke them.
                </PermissionNotice>
              </div>
            ) : null}
            {revealed ? (
              <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/20 p-4">
                <p className="text-xs text-amber-200">
                  Copy this token now. It will not be shown again.
                </p>
                <code className="mt-2 block break-all text-sm text-white">
                  {revealed}
                </code>
              </div>
            ) : null}
            {error ? (
              <p className="mb-4 text-sm text-red-400">{error}</p>
            ) : null}
            <Button
              variant="primary"
              onClick={() => void createToken()}
              disabled={!canManage}
              className="mb-4"
            >
              Create read token
            </Button>
            <div className="divide-y divide-neutral-800">
              {tokens.map((token) => (
                <div key={token.id} className="py-3">
                  <div className="text-sm text-neutral-200">
                    {token.label || "Untitled token"} ·{" "}
                    <code>{token.tokenPrefix}…</code>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {token.scopes.join(", ")}
                  </div>
                </div>
              ))}
              {tokens.length === 0 ? (
                <p className="py-6 text-sm text-neutral-500">
                  No management API tokens.
                </p>
              ) : null}
            </div>
          </>
        )}
      </SettingsSection>
      <SettingsSection
        title="Outbound webhooks"
        description="Signed event delivery with retries and delivery history."
      >
        <UpgradeNotice>
          Webhook management will become available with the Release Two delivery
          service.
        </UpgradeNotice>
      </SettingsSection>
    </SettingsPage>
  );
}
