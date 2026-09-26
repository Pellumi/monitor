"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { renderMeasuredValue } from "../core/measurement-state";
import { ShieldCheck } from "lucide-react";

/**
 * Privacy protection.
 *
 * The card used to claim three things the system cannot evidence: a count of
 * blocked fields nothing aggregated, a replay-masking toggle that does not
 * exist, and a custom-rule count with no rule model behind it — all under a
 * hardcoded green ACTIVE badge. It now shows the one real number there is, and
 * says plainly what that number covers.
 */
export function PrivacyStatusCard() {
  const { data } = useDashboard();
  const privacy = data?.privacy;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-5 font-mono text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Privacy Protection
        </span>
        <span
          className={
            privacy
              ? "text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
              : "text-[10px] text-neutral-400 font-bold px-2 py-0.5 rounded bg-[#222] border border-[#333]"
          }
        >
          {privacy ? "ALWAYS ON" : "NOT REPORTED"}
        </span>
      </div>

      {privacy ? (
        <div className="space-y-3 text-neutral-300">
          <div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Protected values</span>
              <span className="text-white font-semibold">
                {renderMeasuredValue(privacy.protectedFieldCount, (value) => String(value.total))}
              </span>
            </div>
            {privacy.protectedFieldCount.value && (
              <span className="text-[10px] text-neutral-500 block mt-0.5">
                {privacy.protectedFieldCount.value.secrets} secrets ·{" "}
                {privacy.protectedFieldCount.value.identifiers} identifiers, across guided runs
              </span>
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-neutral-500">Capture masking</span>
            <span className="text-emerald-400 font-semibold">Always on</span>
          </div>

          <div className="pt-1">
            <span className="text-neutral-500 block mb-1">Protected automatically</span>
            <ul className="space-y-0.5">
              {privacy.protectedCategories.map((category) => (
                <li key={category} className="text-[11px] text-neutral-300">
                  {category}
                </li>
              ))}
            </ul>
          </div>

          {/* Said explicitly, because the number cannot cover SDK traffic:
              redaction there happens in the browser and the original value
              never reaches us to be counted. */}
          <p className="text-[10px] text-neutral-500 leading-relaxed pt-1 border-t border-[#262626]">
            Counted across guided runs. SDK telemetry is redacted in your application
            before it is sent, so those values are never received and cannot be counted here.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          Capture-time protection is always on. No guided-run evidence has been
          recorded for this application yet.
        </p>
      )}

      <div className="pt-2 border-t border-[#262626]">
        <Link
          href="/settings/security"
          className="text-neutral-400 hover:text-white underline text-[11px]"
        >
          Manage Privacy Settings
        </Link>
      </div>
    </div>
  );
}
