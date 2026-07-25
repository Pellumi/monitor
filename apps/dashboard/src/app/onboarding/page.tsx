"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONBOARDING_API = "/api-gateway";

interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: organizations,
    isLoading,
    error,
  } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await authenticatedFetch(`${ONBOARDING_API}/organizations`);
      if (!res.ok) throw new Error("Failed to load organizations");
      return res.json();
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await authenticatedFetch(`${ONBOARDING_API}/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create organization");
      return res.json() as Promise<Organization>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setSelectedOrgId(data.id);
      setIsCreating(false);
      setNewOrgName("");
    },
  });

  function handleNext() {
    if (!selectedOrgId) return;
    const org = organizations?.find((o) => o.id === selectedOrgId);
    router.push(
      `/onboarding/new-app?orgId=${selectedOrgId}&orgName=${encodeURIComponent(org?.name ?? "")}`,
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center font-mono">
        <div className="text-neutral-400 animate-pulse text-sm">
          Loading organizations…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-4 rounded-md border border-[#262626] bg-[#131313] p-8 shadow-2xl">
        <div className="w-full flex justify-between items-start">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Select Organization
          </h2>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            ORGANIZATION // SELECT
          </span>
        </div>
        <div className="text-left">
          <p className="text-sm text-[#c4c7c8] leading-relaxed">
            Choose an existing organization or create a new one to get started.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-950/20 p-4 text-xs font-mono text-red-400 border border-red-900/30">
            {(error as Error).message}
          </div>
        )}

        <div className="space-y-6">
          {isCreating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newOrgName.trim())
                  createOrgMutation.mutate(newOrgName.trim());
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="org-name"
                  className="block text-xs font-mono font-medium uppercase tracking-wider text-[#8e9192]"
                >
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  className="mt-1.5 block w-full rounded-md border border-[#262626] bg-black px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                />
              </div>

              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsCreating(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={createOrgMutation.isPending || !newOrgName.trim()}
                  className="flex-1"
                >
                  {createOrgMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {organizations && organizations.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {organizations.map((org) => {
                    const isSelected = selectedOrgId === org.id;
                    return (
                      <button
                        key={org.id}
                        onClick={() => setSelectedOrgId(org.id)}
                        className={`w-full flex items-center justify-between rounded-md border p-4 text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-white bg-black text-white font-semibold"
                            : "border-[#262626] bg-black/60 hover:bg-black text-neutral-300"
                        }`}
                      >
                        <span className="text-sm font-medium">{org.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-neutral-500 font-mono">
                  No organizations found. Create one to continue.
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center space-x-2 rounded-md border border-dashed border-[#262626] hover:border-neutral-500 bg-black/40 py-3.5 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Organization</span>
              </button>
            </div>
          )}

          {!isCreating && (
            <Button
              onClick={handleNext}
              variant="primary"
              size="lg"
              disabled={!selectedOrgId}
              className="w-full"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
