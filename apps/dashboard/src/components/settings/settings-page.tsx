"use client";

import type { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { useSession } from "@/components/providers";

type SettingsScope = "USER" | "ORGANIZATION" | "APPLICATION";

export function SettingsPage({
  title,
  description,
  scope,
  children,
}: {
  title: string;
  description: string;
  scope: SettingsScope;
  children: ReactNode;
}) {
  const { selectedOrg, selectedOrgId } = useSession();
  const scopeValue =
    scope === "USER"
      ? "Your account"
      : scope === "ORGANIZATION"
        ? selectedOrg?.name ?? "No organisation selected"
        : selectedOrgId
          ? "Selected application"
          : "No organisation selected";

  return (
    <div className="mx-auto w-full space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {scope.toLowerCase()} scope
          </span>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-neutral-400">{description}</p>
        <div className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-neutral-400">
          <span className="text-neutral-600">Applies to</span>
          <span className="font-medium text-neutral-200">{scopeValue}</span>
        </div>
      </header>
      {children}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-800 bg-[#111111]">
      <div className="border-b border-neutral-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function UpgradeNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div>{children}</div>
    </div>
  );
}

export function PermissionNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SettingsToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-neutral-200">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-neutral-500">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-white disabled:opacity-40"
      />
    </label>
  );
}
