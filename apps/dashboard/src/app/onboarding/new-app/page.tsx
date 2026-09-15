"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/providers";

const ONBOARDING_API = "/api-gateway";

/** Every list that shows an organization's applications, refreshed after a create. */
const APPLICATION_LIST_KEYS = ["organization-applications", "sidebar-apps", "apps"] as const;

interface Application {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
}

function NewAppContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSelectedOrgId } = useSession();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId") ?? "";
  const orgName = searchParams.get("orgName") ?? "";
  const marketingUrl =
    process.env.NEXT_PUBLIC_MARKETING_URL || "https://domain-name.com";

  const [appName, setAppName] = useState("");

  // Plan limits load beside the form rather than in front of it. The cloud
  // enforces the limit on create regardless, so a slow check never holds up a
  // user who is within it.
  const { data: entitlement } = useQuery({
    queryKey: ["entitlement", orgId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/organizations/${orgId}/entitlement`,
      );
      if (!res.ok) throw new Error("Failed to load entitlement");
      return res.json();
    },
    enabled: !!orgId,
  });

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["apps", orgId],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/organizations/${orgId}/applications`,
      );
      if (!res.ok) throw new Error("Failed to load applications");
      return res.json();
    },
    enabled: !!orgId,
  });

  const createAppMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await authenticatedFetch(
        `${ONBOARDING_API}/organizations/${orgId}/applications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name }),
        },
      );
      if (!res.ok) {
        let errMsg = "Failed to create application";
        try {
          const errData = await res.json();
          if (errData.message) {
            errMsg = errData.message;
          }
        } catch {}
        throw new Error(errMsg);
      }
      const app = (await res.json()) as Application;
      return app;
    },
    onSuccess: (app) => {
      // The sidebar and every app-scoped page read the session's organization,
      // so the new application must be visible there when the next page loads.
      setSelectedOrgId(orgId);
      for (const key of APPLICATION_LIST_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key, orgId] });
      }
      // Connecting the SDK is the next step; declaring flows comes after it.
      const id = encodeURIComponent(app.id);
      router.push(`/applications/${id}/connect?appId=${id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (appName.trim()) {
      createAppMutation.mutate({
        name: appName.trim(),
      });
    }
  }

  if (!orgId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-red-400">
          Error: Organization context is missing. Please restart onboarding.
        </div>
      </div>
    );
  }

  const appLimit = entitlement?.limits?.applications ?? 1;
  const hasReachedLimit =
    entitlement !== undefined && apps !== undefined && apps.length >= appLimit;

  if (hasReachedLimit) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-8 rounded-md border border-[#262626] bg-[#131313] p-8 shadow-2xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-[#262626] bg-black text-white">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Limit Reached
            </h2>
            <p className="text-sm text-[#c4c7c8] leading-relaxed">
              Your organization{" "}
              <span className="font-semibold text-white">{orgName}</span> has
              onboarded{" "}
              <span className="font-semibold text-white">{apps.length}</span>{" "}
              of <span className="font-semibold text-white">{appLimit}</span>{" "}
              allowed applications on the{" "}
              <span className="font-mono text-white font-semibold uppercase">
                {entitlement?.planType}
              </span>{" "}
              plan.
            </p>
          </div>
          <div className="pt-2 space-y-3">
            <a
              href={`${marketingUrl}/pricing`}
              className="w-full flex items-center justify-center space-x-2 rounded-md bg-white hover:bg-neutral-200 py-3 text-sm font-semibold text-black transition-colors cursor-pointer"
            >
              <span>Upgrade Plan</span>
            </a>
            <Button
              variant="secondary"
              onClick={() => router.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] h-full items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8 rounded-md border border-[#262626] bg-[#131313] p-8 shadow-2xl">
        <div className="w-full flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Name your application
          </h2>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            APP // CREATE
          </span>
        </div>
        <div className="text-left">
          <p className="mt-2 text-sm text-[#c4c7c8] leading-relaxed">
            You&apos;ll connect it to your project on the next screen.
          </p>
        </div>

        {createAppMutation.error && (
          <div className="rounded-md bg-red-950/20 p-4 text-xs font-mono text-red-400 border border-red-900/30">
            {(createAppMutation.error as Error).message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="app-name"
              className="block text-xs font-mono font-medium uppercase tracking-wider text-[#8e9192]"
            >
              Application Name
            </label>
            <input
              id="app-name"
              type="text"
              required
              autoFocus
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Production E-commerce Store"
              className="mt-1.5 block w-full rounded-md border border-[#262626] bg-black px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={createAppMutation.isPending || !appName.trim()}
            className="w-full"
          >
            <span>
              {createAppMutation.isPending ? "Creating…" : "Create and connect"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="text-center font-mono text-[11px] leading-relaxed text-[#8e9192]">
          Creating in{" "}
          <span className="text-white">{orgName || "your organization"}</span>
          {" · "}
          <Link
            href="/onboarding?pick=1"
            className="underline underline-offset-2 hover:text-white"
          >
            Use a different organization
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function NewAppPage() {
  return (
    <Suspense
      fallback={<div className="text-neutral-400 animate-pulse">Loading…</div>}
    >
      <NewAppContent />
    </Suspense>
  );
}
