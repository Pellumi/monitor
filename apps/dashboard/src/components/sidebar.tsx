"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { usePreferences } from '@/components/preferences-provider';
import {
  getLastApplication,
  getLastEnvironment,
  preferRemembered,
  rememberLastApplication,
  rememberLastEnvironment,
} from '@/lib/last-selection';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useState,
  useEffect,
  useRef,
  Suspense,
  createContext,
  useContext,
} from "react";
import {
  Activity,
  GitGraph,
  LayoutDashboard,
  AlertCircle,
  AlertTriangle,
  PlaySquare,
  Zap,
  ChevronDown,
  ChevronRight,
  Building2,
  Plus,
  Trash2,
  ClipboardList,
  GitCompare,
  FileText,
  ShieldAlert,
  X,
  Settings,
  Users,
  CreditCard,
  User,
  Shield,
  Brain,
  Code2,
  ListChecks,
  TrendingUp,
  Lock,
  Globe,
  LogOut,
  ArrowLeft,
  Bell,
  SlidersHorizontal,
  Database,
  Plug,
  ScrollText,
  KeyRound,
  Laptop,
  FolderKanban,
} from "lucide-react";
import { useSession, Membership, Organization } from "./providers";
import { useTheme } from "@/components/theme-provider";
import { useSidebarMode } from "@/components/sidebar-mode";
import { NotificationBell } from "@/components/notification-bell";
import { twMerge } from "tailwind-merge";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Application {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
}

interface Entitlement {
  planType: string;
  features: Record<string, boolean | string>;
  limits: Record<string, number>;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredFeature?: string;
}

// ─────────────────────────────────────────────────────────────
// Entitlement context — shared between AppSelector & NavigationList
// ─────────────────────────────────────────────────────────────

const EntitlementContext = createContext<{
  entitlement: Entitlement | null;
  selectedEnvId: string | null;
}>({ entitlement: null, selectedEnvId: null });

function useEntitlement() {
  return useContext(EntitlementContext);
}

// ─────────────────────────────────────────────────────────────
// Navigation config with feature gates
// ─────────────────────────────────────────────────────────────

const navigation: NavItem[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  {
    name: "Flow Declaration",
    href: "/declare",
    icon: ClipboardList,
    requiredFeature: "BEHAVIOR_GRAPH",
  },
  {
    name: "Behavioral Graph",
    href: "/graph",
    icon: GitGraph,
    requiredFeature: "BEHAVIOR_GRAPH",
  },
  {
    name: "Reconciliation",
    href: "/reconciliation",
    icon: GitCompare,
    requiredFeature: "COVERAGE_ANALYSIS",
  },
  {
    name: "Graph Drift",
    href: "/graph-drift",
    icon: TrendingUp,
    requiredFeature: "COVERAGE_ANALYSIS",
  },
  {
    name: "Workflows",
    href: "/workflows",
    icon: Activity,
    requiredFeature: "WORKFLOW_DISCOVERY",
  },
  {
    name: "Missing States",
    href: "/missing-states",
    icon: AlertCircle,
    requiredFeature: "MISSING_STATE_DETECTION",
  },
  {
    name: "Missing Flows",
    href: "/missing-flows",
    icon: AlertTriangle,
    requiredFeature: "MISSING_FLOW_DETECTION",
  },
  {
    name: "Sessions",
    href: "/sessions",
    icon: PlaySquare,
    requiredFeature: "SESSION_REPLAY",
  },
  {
    name: "Endpoint Analysis",
    href: "/endpoints",
    icon: Zap,
    requiredFeature: "ENDPOINT_INTELLIGENCE",
  },
  {
    name: "QA Runs",
    href: "/qa-runs",
    icon: Laptop,
    requiredFeature: "DESKTOP_GUIDED_RUNS",
  },
  {
    name: "Reports",
    href: "/reports",
    icon: FileText,
    requiredFeature: "REPORT_GENERATION",
  },
];

interface SettingsNavItem extends NavItem {
  hasAppId?: boolean;
}

interface SettingsNavSection {
  label: string;
  items: SettingsNavItem[];
}

const settingsNavigation: SettingsNavSection[] = [
  {
    label: "Personal",
    items: [
      { name: "Profile", href: "/settings/profile", icon: User },
      {
        name: "Preferences",
        href: "/settings/preferences",
        icon: SlidersHorizontal,
      },
      { name: "Notifications", href: "/settings/notifications", icon: Bell },
      { name: "Security & Sessions", href: "/settings/security", icon: Shield },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Organisation", href: "/settings/organization", icon: Building2 },
      {
        name: "Applications",
        href: "/settings/applications",
        icon: FolderKanban,
      },
      { name: "Members & Access", href: "/settings/members", icon: Users },
      { name: "Audit Logs", href: "/settings/audit-logs", icon: ScrollText },
    ],
  },
  {
    label: "Developer & Data",
    items: [
      {
        name: "Environments",
        href: "/settings/environments",
        icon: Globe,
        hasAppId: true,
      },
      {
        name: "Ingestion Keys",
        href: "/settings/ingestion-keys",
        icon: KeyRound,
      },
      { name: "Storage & Retention", href: "/settings/data", icon: Database },
      { name: "Integrations", href: "/settings/integrations", icon: Plug },
    ],
  },
  {
    label: "Plan",
    items: [
      { name: "Billing & Usage", href: "/settings/billing", icon: CreditCard },
    ],
  },
];

const adminNavigation: NavItem[] = [
  { name: "Rulesets", href: "/admin/rulesets", icon: Code2 },
  {
    name: "Audit Logs",
    href: "/admin/audit-logs",
    icon: Shield,
    requiredFeature: "AUDIT_LOGS",
  },
  { name: "AI Usage", href: "/admin/ai-usage", icon: Brain },
  { name: "Rule Candidates", href: "/admin/rule-candidates", icon: ListChecks },
  { name: "Job Monitor", href: "/admin/jobs", icon: Activity },
];

// ─────────────────────────────────────────────────────────────
// Helper: check if a feature is enabled on the entitlement
// ─────────────────────────────────────────────────────────────

function isFeatureEnabled(
  entitlement: Entitlement | null,
  feature?: string,
): boolean {
  if (!feature) return true;
  if (!entitlement?.features) return true;
  const value = entitlement.features[feature];
  if (value === undefined) return true;
  return value === true || (typeof value === "string" && value !== "false");
}

// ─────────────────────────────────────────────────────────────
// AppSelector (Org + App + Environment)
// ─────────────────────────────────────────────────────────────

function AppSelector({
  onEntitlementLoaded,
  onEnvSelected,
}: {
  onEntitlementLoaded: (e: Entitlement | null) => void;
  onEnvSelected: (envId: string | null) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedOrg, selectedOrgId, setSelectedOrgId, memberships } =
    useSession();
  const routeParams = useParams<{ appId?: string }>();
  const currentAppId = routeParams?.appId || searchParams.get("appId");
  const currentEnvId = searchParams.get("envId");
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);
  const [isDeletingApp, setIsDeletingApp] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const marketingUrl =
    process.env.NEXT_PUBLIC_MARKETING_URL || "https://domain-name.com";

  async function handleDeleteApp() {
    if (!appToDelete) return;
    setIsDeletingApp(true);
    setDeleteError(null);
    try {
      const res = await authenticatedFetch(
        `/api-gateway/applications/${appToDelete.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || errData.message || "Failed to delete application",
        );
      }

      const deletedId = appToDelete.id;
      setAppToDelete(null);
      setIsOpen(false);

      await queryClient.invalidateQueries({
        queryKey: ["sidebar-apps", selectedOrgId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["organization-applications", selectedOrgId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sidebar-entitlement", selectedOrgId],
      });

      if (selectedApp?.id === deletedId) {
        const remaining = apps?.filter((a) => a.id !== deletedId) ?? [];
        const params = new URLSearchParams(searchParams.toString());
        if (remaining.length > 0) {
          params.set("appId", remaining[0].id);
          params.delete("envId");
          router.push(`${pathname}?${params.toString()}`);
        } else {
          params.delete("appId");
          params.delete("envId");
          router.push("/onboarding");
        }
      }
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete application");
    } finally {
      setIsDeletingApp(false);
    }
  }

  const { data: apps } = useQuery<Application[]>({
    queryKey: ["sidebar-apps", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await authenticatedFetch(
        `/api-gateway/organizations/${selectedOrgId}/applications`,
      );
      if (!res.ok) throw new Error("Failed to fetch apps");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const { data: entitlement } = useQuery<Entitlement>({
    queryKey: ["sidebar-entitlement", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await authenticatedFetch(
        `/api-gateway/organizations/${selectedOrgId}/entitlement`,
      );
      if (!res.ok) throw new Error("Failed to fetch entitlement");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const { preferences } = usePreferences();

  // With no ?appId in the URL, fall back to where the user left off rather than
  // the first application in the list.
  const rememberedApp = preferRemembered(
    apps,
    getLastApplication(selectedOrgId),
    preferences.rememberLastApplication,
    apps?.[0],
  );
  const selectedApp = apps?.find((a) => a.id === currentAppId) ?? rememberedApp;

  // Fetch environments for the selected app
  const { data: environments } = useQuery<Environment[]>({
    queryKey: ["sidebar-envs", selectedApp?.id],
    queryFn: async () => {
      if (!selectedApp?.id) return [];
      const res = await authenticatedFetch(
        `/api-gateway/applications/${selectedApp.id}/environments`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedApp?.id,
  });

  const hasMultipleEnvs = isFeatureEnabled(
    entitlement ?? null,
    "MULTIPLE_ENVIRONMENTS",
  );
  const rememberedEnv = preferRemembered(
    environments,
    getLastEnvironment(selectedApp?.id),
    preferences.rememberLastEnvironment,
    environments?.find((e) => e.isDefault) ?? environments?.[0],
  );
  const selectedEnv =
    environments?.find((e) => e.id === currentEnvId) ?? rememberedEnv;

  // Propagate entitlement and env selection up
  useEffect(() => {
    onEntitlementLoaded(entitlement ?? null);
  }, [entitlement, onEntitlementLoaded]);

  useEffect(() => {
    onEnvSelected(selectedEnv?.id ?? null);
  }, [selectedEnv?.id, onEnvSelected]);

  // Auto-select an app if the URL names none (or names one that is not in this
  // organisation), preferring the remembered one.
  useEffect(() => {
    if (
      apps &&
      apps.length > 0 &&
      selectedApp &&
      (!currentAppId || !apps.some((a) => a.id === currentAppId))
    ) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("appId", selectedApp.id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [apps, currentAppId, selectedApp, pathname, router, searchParams]);

  // Keep the remembered selection in step with what is actually active.
  useEffect(() => {
    if (currentAppId) rememberLastApplication(selectedOrgId, currentAppId);
  }, [currentAppId, selectedOrgId]);

  useEffect(() => {
    if (currentAppId && currentEnvId) rememberLastEnvironment(currentAppId, currentEnvId);
  }, [currentAppId, currentEnvId]);

  // Auto-select default environment
  useEffect(() => {
    if (
      environments &&
      environments.length > 0 &&
      selectedEnv &&
      !currentEnvId
    ) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("envId", selectedEnv.id);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [environments, selectedEnv, currentEnvId, pathname, router, searchParams]);

  function handleSelect(appId: string) {
    rememberLastApplication(selectedOrgId, appId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("appId", appId);
    params.delete("envId");
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  }

  function handleEnvSelect(envId: string) {
    rememberLastEnvironment(selectedApp?.id, envId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("envId", envId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative px-3 mb-3 space-y-1.5">
      {/* Org Selector */}
      {memberships.length > 1 ? (
        <>
          <span className="text-[10px] font-mono text-[#8e9192] tracking-[.04em] truncate">
            Organization
          </span>
          <Select
            value={selectedOrgId || ""}
            onValueChange={(val) => {
              setSelectedOrgId(val);
              const params = new URLSearchParams(searchParams.toString());
              params.delete("appId");
              params.delete("envId");
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            <SelectTrigger className="text-[10px] font-mono tracking-[.06em] uppercase text-[#8e9192] py-1.5 border-[#262626] bg-black hover:border-[#3a3a3a] transition-colors">
              <SelectValue placeholder="Select organisation…">
                {memberships.find((m) => m.organization.id === selectedOrgId)
                  ?.organization.name ?? ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {memberships.map((m) => (
                <SelectItem
                  key={m.organization.id}
                  value={m.organization.id}
                  className="text-[10px] font-mono tracking-[.06em] uppercase"
                >
                  {m.organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        memberships.length === 1 && (
          <div className="text-[10px] font-mono tracking-[.08em] uppercase text-[#8e9192] px-1 pb-0.5">
            {memberships[0].organization.name}
          </div>
        )
      )}

      <span className="text-[10px] font-mono text-[#8e9192] tracking-[.04em] truncate">
        Application
      </span>
      {/* App Selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!apps || apps.length === 0}
        className="w-full flex items-center justify-between border border-[#262626] bg-[#131313] px-3 py-2 text-left transition-all hover:bg-black hover:border-[#3a3a3a] disabled:opacity-40 cursor-pointer"
      >
        <div className="truncate pr-2">
          <div className="font-semibold text-white truncate text-xs tracking-tight">
            {selectedApp ? selectedApp.name : "No Applications"}
          </div>
        </div>
        {apps && apps.length > 0 && (
          <ChevronDown
            className={twMerge(
              "h-3.5 w-3.5 text-[#8e9192] flex-shrink-0 transition-transform duration-150",
              isOpen && "rotate-180",
            )}
          />
        )}
      </button>

      {isOpen && apps && apps.length > 0 && (
        <div className="absolute left-3 right-3 z-50 border border-[#262626] bg-[#0a0a0a] shadow-2xl max-h-60 overflow-y-auto">
          <div className="py-0">
            {apps.map((app) => (
              <div
                key={app.id}
                onClick={() => handleSelect(app.id)}
                className={twMerge(
                  "group flex items-center justify-between w-full px-3 py-2.5 text-xs font-mono hover:bg-[#131313] transition-colors cursor-pointer border-b border-[#1a1a1a] last:border-b-0",
                  selectedApp?.id === app.id
                    ? "bg-[#131313] text-white"
                    : "text-[#8e9192]",
                )}
              >
                <div className="truncate pr-2">{app.name}</div>
                <button
                  type="button"
                  title="Delete Application"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAppToDelete(app);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#8e9192] hover:text-red-400 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            <div className="border-t border-[#262626]">
              <button
                onClick={(e) => {
                  setIsOpen(false);
                  const limit = entitlement?.limits?.applications ?? 1;
                  const currentCount = apps?.length ?? 0;
                  if (currentCount >= limit) {
                    setShowLimitModal(true);
                  } else {
                    router.push("/onboarding");
                  }
                }}
                className="flex items-center gap-2 px-3 py-2.5 text-[11px] font-mono text-[#8e9192] hover:bg-[#131313] hover:text-white transition-colors w-full text-left cursor-pointer tracking-[.04em]"
              >
                <Plus className="h-3 w-3" />
                <span>Add Application…</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Environment Selector */}
      {environments && environments.length > 0 && (
        hasMultipleEnvs && environments.length > 1 ? (
          <Select
            value={selectedEnv?.id || ""}
            onValueChange={(val) => handleEnvSelect(val)}
          >
            <SelectTrigger className="text-[10px] font-mono tracking-[.06em] uppercase text-[#8e9192] py-1.5 border-[#262626] bg-black hover:border-[#3a3a3a] transition-colors">
              <SelectValue placeholder="Select environment…">
                {selectedEnv ? `${selectedEnv.name} (${selectedEnv.type})` : ""}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {environments.map((env) => (
                <SelectItem
                  key={env.id}
                  value={env.id}
                  className="text-[10px] font-mono tracking-[.06em] uppercase"
                >
                  {env.name} ({env.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center border border-[#1e1e1e] bg-black px-2.5 py-1.5">
            <span className="text-[10px] font-mono text-[#8e9192] tracking-[.04em] truncate">
              {selectedEnv?.name ?? "Default"} · {selectedEnv?.type ?? "env"}
            </span>
          </div>
        )
      )}

      {/* Application Limit Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">
                TELLANN
              </span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                Plan // Limit
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Application Limit Reached
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                You have reached the maximum number of applications allowed on
                your plan ({entitlement?.limits?.applications ?? 1}{" "}
                application). Please upgrade your plan to onboard more
                applications.
              </p>
            </div>
            <div className="bg-black border border-[#262626] divide-y divide-[#262626]">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">
                  CURRENT LIMIT
                </span>
                <span className="text-white text-xs font-mono">
                  {entitlement?.limits?.applications ?? 1} App
                  {(entitlement?.limits?.applications ?? 1) > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">
                  REQUIRED ACTION
                </span>
                <span className="text-white text-xs font-mono uppercase">
                  UPGRADE PLAN
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="flex-1 h-10 flex items-center justify-center border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <a
                href={`${marketingUrl}/pricing`}
                className="flex-1 h-10 flex items-center justify-center border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors text-center cursor-pointer"
              >
                Upgrade Plan
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Application Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">
                TELLANN
              </span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                App // Delete
              </span>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="border border-[#262626] bg-black p-3 text-xs font-mono text-neutral-300"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0 text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white leading-snug">
                      Deletion Failed
                    </p>
                    <p className="mt-0.5 text-[#8e9192] leading-relaxed">
                      {deleteError}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteError(null)}
                    className="shrink-0 text-[#8e9192] hover:text-white p-0.5 transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Delete Application
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                Are you sure you want to delete{" "}
                <strong className="text-white font-semibold">
                  {appToDelete.name}
                </strong>
                ? This action cannot be undone and will permanently remove all
                associated environments, API keys, sessions, and behavior
                graphs.
              </p>
            </div>

            <div className="bg-black border border-[#262626] divide-y divide-[#262626]">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">
                  APPLICATION
                </span>
                <span className="text-white text-xs font-mono font-semibold truncate max-w-[200px] text-right">
                  {appToDelete.name}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">
                  ACTION TYPE
                </span>
                <span className="text-white text-xs font-mono uppercase">
                  PERMANENT DELETE
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAppToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeletingApp}
                className="flex-1 h-10 flex items-center justify-center border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteApp}
                disabled={isDeletingApp}
                className="flex-1 h-10 flex items-center justify-center border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeletingApp ? "Deleting…" : "Delete Application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NavigationList — with entitlement gating
// ─────────────────────────────────────────────────────────────

function NavigationList({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeParams = useParams<{ appId?: string }>();
  const appId = routeParams?.appId || searchParams.get("appId");
  const envId = searchParams.get("envId");
  const { entitlement } = useEntitlement();

  const isSettingsMode = pathname.startsWith("/settings");
  const isAdminMode = pathname.startsWith("/admin");
  const isMainAppMode = !isSettingsMode && !isAdminMode;

  // Track last main app path so "Back to App" returns to the user's previous active page
  useEffect(() => {
    if (
      isMainAppMode &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/onboarding")
    ) {
      const fullPath = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      sessionStorage.setItem("lastMainAppPath", fullPath);
    }
  }, [pathname, searchParams, isMainAppMode]);

  function handleBackToApp() {
    const lastPath = sessionStorage.getItem("lastMainAppPath");
    if (lastPath) {
      router.push(lastPath);
    } else {
      const params = new URLSearchParams();
      if (appId) params.set("appId", appId);
      if (envId) params.set("envId", envId);
      router.push(params.toString() ? `/?${params.toString()}` : "/");
    }
  }

  function buildHref(href: string, hasAppId = true) {
    const params = new URLSearchParams();
    if (hasAppId && appId) params.set("appId", appId);
    if (hasAppId && envId) params.set("envId", envId);
    return params.toString() ? `${href}?${params.toString()}` : href;
  }

  const renderNavItem = (item: NavItem, hasAppId = true) => {
    const enabled = isFeatureEnabled(entitlement, item.requiredFeature);
    const isActive =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href + "/"));

    if (collapsed) {
      if (!enabled) {
        return (
          <button
            key={item.name}
            onClick={() => router.push("/settings/billing?upgrade=1")}
            title={`Upgrade your plan to access ${item.name}`}
            aria-label={`Upgrade your plan to access ${item.name}`}
            className="group relative mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-md text-[#3a3a3a] transition-colors hover:bg-[#131313] hover:text-[#5a5a5a]"
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <Lock className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-[#3a3a3a] group-hover:text-amber-700/60" />
          </button>
        );
      }
      return (
        <Link
          key={item.name}
          href={buildHref(item.href, hasAppId)}
          title={item.name}
          aria-label={item.name}
          className={twMerge(
            "group mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            isActive
              ? "bg-white text-black"
              : "text-[#8e9192] hover:bg-[#131313] hover:text-white",
          )}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        </Link>
      );
    }

    if (!enabled) {
      return (
        <button
          key={item.name}
          onClick={() => router.push("/settings/billing?upgrade=1")}
          className="group flex items-center justify-between px-3 py-2 text-xs font-mono text-[#3a3a3a] hover:bg-[#131313] hover:text-[#5a5a5a] w-full text-left cursor-pointer transition-colors"
          title={`Upgrade your plan to access ${item.name}`}
        >
          <div className="flex items-center">
            <item.icon className="mr-3 h-3.5 w-3.5 flex-shrink-0 text-[#2a2a2a]" />
            {item.name}
          </div>
          <Lock className="h-3 w-3 text-[#3a3a3a] group-hover:text-amber-700/60" />
        </button>
      );
    }

    const fullHref = buildHref(item.href, hasAppId);
    return (
      <Link
        key={item.name}
        href={fullHref}
        className={twMerge(
          "group flex items-center px-3 py-2 text-xs font-mono transition-colors",
          isActive
            ? "bg-white text-black"
            : "text-[#8e9192] hover:bg-[#131313] hover:text-white",
        )}
      >
        <item.icon
          className={twMerge(
            "mr-3 h-3.5 w-3.5 flex-shrink-0 transition-colors",
            isActive ? "text-black" : "text-[#555] group-hover:text-white",
          )}
          aria-hidden="true"
        />
        {item.name}
      </Link>
    );
  };

  return (
    <nav
      className={twMerge(
        "flex-1 py-2 overflow-y-auto space-y-0.5",
        collapsed ? "px-2" : "px-3",
      )}
    >
      {/* ── Back to App Button (shown in Settings or Admin mode) ─── */}
      {!isMainAppMode &&
        (collapsed ? (
          <button
            type="button"
            onClick={handleBackToApp}
            title="Back to App"
            aria-label="Back to App"
            className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-md border-b border-[#262626] text-[#8e9192] transition-colors hover:bg-[#131313] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBackToApp}
            className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-[#8e9192] hover:text-white hover:bg-[#131313] w-full text-left mb-2 border-b border-[#262626] pb-3 cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to App</span>
          </button>
        ))}

      {/* ── Main App Navigation Mode ─── */}
      {isMainAppMode && (
        <>{navigation.map((item) => renderNavItem(item, true))}</>
      )}

      {/* ── Settings Navigation Mode ─── */}
      {isSettingsMode && (
        <div className={collapsed ? "space-y-0.5" : "space-y-4"}>
          {settingsNavigation.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-[.1em] text-[#444748]">
                  {section.label}
                </p>
              )}
              {section.items.map((item) =>
                renderNavItem(item, item.hasAppId ?? false),
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Admin Navigation Mode ─── */}
      {isAdminMode && (
        <div>
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-mono font-semibold uppercase tracking-[.1em] text-amber-600/80">
              Admin
            </p>
          )}
          {adminNavigation.map((item) => renderNavItem(item, false))}
        </div>
      )}
    </nav>
  );
}

function UserProfile({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const isSystemAdmin = (user as any)?.isSystemAdmin === true;
  const initial = (user.displayName?.[0] || user.email[0]).toUpperCase();
  const name = user.displayName || user.email.split("@")[0];
  const docsUrl =
    process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";

  const avatarEl = user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt={name}
      className="w-7 h-7 object-cover flex-shrink-0 border border-[#262626]"
    />
  ) : (
    <div className="w-7 h-7 bg-black border border-[#444748] text-white flex items-center justify-center font-mono font-bold text-[10px] flex-shrink-0 tracking-widest">
      {initial}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative border-t border-[#262626] flex-shrink-0"
    >
      {/* Popover — appears above the trigger, matching desktop AppShell pattern */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Profile menu"
          className={twMerge(
            "absolute bottom-full border border-[#262626] border-b-0 bg-[#0a0a0a] shadow-2xl z-50 animate-in fade-in duration-100",
            collapsed ? "left-0 w-56" : "left-0 right-0",
          )}
        >
          {/* Profile summary row — click navigates to profile settings */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              router.push("/settings/profile");
            }}
            className="flex items-center gap-2.5 w-full px-4 py-3 border-b border-[#262626] hover:bg-[#131313] transition-colors cursor-pointer group text-left"
          >
            {avatarEl}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate group-hover:underline">
                {name}
              </div>
              <div className="text-[10px] font-mono text-[#8e9192] truncate">
                {user.email}
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#444748] flex-shrink-0" />
          </button>

          {/* Action items */}
          <div className="py-1">
            <Link
              href="/settings/profile"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-mono text-[#8e9192] hover:text-white hover:bg-[#131313] transition-colors"
            >
              <Settings className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Profile settings</span>
            </Link>

            {isSystemAdmin && (
              <Link
                href="/admin/rulesets"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-mono text-[#8e9192] hover:text-white hover:bg-[#131313] transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Admin</span>
              </Link>
            )}

            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-mono text-[#8e9192] hover:text-white hover:bg-[#131313] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Documentation</span>
            </a>

            <div className="border-t border-[#1e1e1e] mt-1 pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  setShowLogoutModal(true);
                }}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-mono text-[#8e9192] hover:text-red-400 hover:bg-[#131313] transition-colors w-full text-left cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Row */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        title={collapsed ? name : undefined}
        className={twMerge(
          "flex items-center hover:bg-[#131313] transition-colors text-left focus:outline-none cursor-pointer",
          collapsed ? "justify-center px-0 py-3 w-full" : "gap-2.5 w-full px-4 py-3",
        )}
      >
        {avatarEl}
        {!collapsed && (
          <span className="flex-1 text-xs font-semibold text-white truncate min-w-0">
            {name}
          </span>
        )}
      </button>

      {/* Sign Out Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">
                TELLANN
              </span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                Auth // Sign Out
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Sign out of Tellann?
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                Are you sure you want to sign out? You will need to sign in
                again to access your workspace.
              </p>
            </div>
            <div className="bg-black border border-[#262626] divide-y divide-[#262626]">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">
                  ACCOUNT
                </span>
                <span className="text-white text-xs font-mono truncate max-w-[180px] text-right">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">
                  ACTION
                </span>
                <span className="text-white text-xs font-mono uppercase">
                  SIGN OUT
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 h-10 flex items-center justify-center border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <Link
                href="/auth/logout"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 h-10 flex items-center justify-center border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Confirm Sign Out
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar (root)
// ─────────────────────────────────────────────────────────────

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_WIDTH_STORAGE_KEY = "sidebar-width";

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));
}

export function Sidebar() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const { collapsed } = useSidebarMode();
  const { resolvedTheme } = useTheme();
  const iconSrc =
    resolvedTheme === "light" ? "/logo_icon_black.svg" : "/logo_icon.svg";

  // ── Adjustable width (drag the right edge; persisted per browser) ──
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (stored) {
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed)) setWidth(clampSidebarWidth(parsed));
      }
    } catch {
      /* localStorage unavailable — fall back to the default width */
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    function onMouseMove(event: MouseEvent) {
      // The sidebar is pinned to the viewport's left edge, so the pointer's
      // x position is the target width.
      setWidth(clampSidebarWidth(event.clientX));
    }
    function onMouseUp() {
      setIsResizing(false);
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width));
    } catch {
      /* ignore persistence failures */
    }
  }, [width]);

  return (
    <EntitlementContext.Provider value={{ entitlement, selectedEnvId }}>
      <div
        style={collapsed ? undefined : { width }}
        className={twMerge(
          "relative hidden h-full shrink-0 flex-col border-r border-[#262626] bg-[#0a0a0a] md:flex",
          !isResizing && "transition-[width] duration-200",
          collapsed && "w-16",
        )}
      >
        {/* Drag handle — resize between 200px and 500px; double-click to reset */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
            onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)}
            className={twMerge(
              "absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#3a3a3a]",
              isResizing && "bg-[#3a3a3a]",
            )}
          />
        )}

        {/* Logo header */}
        <div
          className={twMerge(
            "flex h-14 items-center border-b border-[#262626] shrink-0",
            collapsed ? "justify-center px-0" : "justify-between px-4",
          )}
        >
          <Link href="/" className="flex items-center">
            {collapsed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconSrc} alt="Tellann" className="h-7 w-7" />
            ) : (
              <h1 className="text-[18px] font-extrabold tracking-tighter text-white uppercase">
                TELLANN
              </h1>
            )}
          </Link>
          {!collapsed && <NotificationBell />}
        </div>

        <Suspense
          fallback={
            <div className="h-10 px-4 mb-3 text-[10px] font-mono text-[#444748] animate-pulse pt-4">
              Loading…
            </div>
          }
        >
          {/* Kept mounted while collapsed so entitlement and environment
              selection still load for the navigation gating below. */}
          <div className={collapsed ? "hidden" : "pt-3"}>
            <AppSelector
              onEntitlementLoaded={setEntitlement}
              onEnvSelected={setSelectedEnvId}
            />
          </div>
        </Suspense>

        <Suspense
          fallback={
            <div className="px-4 text-[10px] font-mono text-[#444748] animate-pulse">
              Loading menu…
            </div>
          }
        >
          <NavigationList collapsed={collapsed} />
        </Suspense>

        <UserProfile collapsed={collapsed} />
      </div>
    </EntitlementContext.Provider>
  );
}
