"use client";
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Key,
  Copy,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  QrCode,
  ChevronDown,
} from "lucide-react";

const AUTH_API = "/api-gateway/auth";

// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
    >
      {copied ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MFAContent() {
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "backup">("idle");
  const [secretBase32, setSecretBase32] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [token, setToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableToken, setDisableToken] = useState("");
  const [error, setError] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  // Load current MFA status
  const {
    data: mfaStatus,
    isLoading,
    refetch: refetchStatus,
  } = useQuery<{ totpEnabled: boolean; backupCodesRemaining: number }>({
    queryKey: ["mfa-status"],
    queryFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/status`);
      if (!res.ok) throw new Error("Failed to load MFA status");
      return res.json();
    },
  });

  // Step 1: Begin TOTP setup — fetch secret + URI
  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/setup`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start MFA setup");
      return res.json() as Promise<{ secret: string; uri: string }>;
    },
    onSuccess: (data) => {
      setSecretBase32(data.secret);
      setOtpauthUri(data.uri);
      setStep("setup");
      setError("");
    },
    onError: (err: any) => setError(err?.message ?? "Setup failed"),
  });

  // Step 2: Verify TOTP and get backup codes
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretBase32, token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Verification failed — check your code");
      }
      return res.json() as Promise<{ backupCodes: string[] }>;
    },
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setStep("backup");
      setError("");
      void refetchStatus();
    },
    onError: (err: any) => setError(err?.message ?? "Invalid token"),
  });

  // Disable MFA
  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: disableToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to disable MFA");
      }
    },
    onSuccess: () => {
      setShowDisable(false);
      setDisableToken("");
      setStep("idle");
      setError("");
      void refetchStatus();
    },
    onError: (err: any) => setError(err?.message ?? "Invalid token"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 text-sm p-6">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading MFA status…
      </div>
    );
  }

  const isEnabled = mfaStatus?.totpEnabled ?? false;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isEnabled ? "bg-emerald-500/10" : "bg-neutral-800"}`}>
          {isEnabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <Shield className="h-5 w-5 text-neutral-400" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Two-Factor Authentication</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {isEnabled
              ? "MFA is active — your account is protected with TOTP authentication."
              : "Add an extra layer of security to your account using an authenticator app."}
          </p>
        </div>
      </div>

      {/* Status card */}
      <div className={`border rounded-xl p-4 flex items-center justify-between ${
        isEnabled
          ? "border-emerald-900/40 bg-emerald-950/20"
          : "border-neutral-800 bg-neutral-900"
      }`}>
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
          )}
          <div>
            <p className={`text-sm font-semibold ${isEnabled ? "text-emerald-300" : "text-amber-300"}`}>
              {isEnabled ? "MFA Enabled" : "MFA Not Configured"}
            </p>
            {isEnabled && mfaStatus?.backupCodesRemaining !== undefined && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {mfaStatus.backupCodesRemaining} backup code
                {mfaStatus.backupCodesRemaining !== 1 ? "s" : ""} remaining
              </p>
            )}
          </div>
        </div>

        {!isEnabled && step === "idle" && (
          <button
            id="setup-mfa-btn"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-sm font-semibold rounded-md transition-colors cursor-pointer"
          >
            {setupMutation.isPending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
            Enable MFA
          </button>
        )}

        {isEnabled && (
          <button
            id="disable-mfa-btn"
            onClick={() => setShowDisable(!showDisable)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#262626] hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Disable
          </button>
        )}
      </div>

      {/* Disable confirmation */}
      {showDisable && isEnabled && (
        <div className="border border-red-900/30 bg-red-950/10 rounded-md p-4 space-y-3">
          <p className="text-sm font-semibold text-red-300">Disable Two-Factor Authentication</p>
          <p className="text-xs text-neutral-400">
            Disabling MFA makes your account less secure. You will only need your password to log in.
          </p>
          <input
            id="disable-totp-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={disableToken}
            onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.3em] text-center focus:outline-none focus:border-red-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setShowDisable(false); setDisableToken(""); setError(""); }}
              className="flex-1 border border-neutral-700 text-neutral-400 hover:bg-neutral-800 py-2 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-disable-mfa-btn"
              onClick={() => disableMutation.mutate()}
              disabled={disableToken.length < 6 || disableMutation.isPending}
              className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2 text-xs font-semibold rounded-lg transition-colors"
            >
              {disableMutation.isPending ? "Disabling…" : "Confirm Disable"}
            </button>
          </div>
        </div>
      )}

      {/* Setup steps */}
      {step === "setup" && (
        <div className="space-y-5">
          {/* Step 1: Scan QR code */}
          <div className="border border-[#262626] bg-[#131313] rounded-md p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-white" />
              <h3 className="text-sm font-semibold text-white">Step 1 — Scan QR Code</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
            </p>

            {/* QR code via Google Charts API (works offline via otpauth URI too) */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-md inline-block">
                <img
                  src={`https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauthUri)}`}
                  alt="TOTP QR Code"
                  width={200}
                  height={200}
                  className="block"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-neutral-500 mb-1">Or enter the key manually:</p>
                <code className="text-sm font-mono text-white bg-black border border-[#262626] px-3 py-1.5 rounded-md tracking-widest block">
                  {secretBase32}
                </code>
                <div className="mt-1.5 flex justify-center">
                  <CopyButton text={secretBase32} label="Copy secret" />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Verify */}
          <div className="border border-[#262626] bg-[#131313] rounded-md p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-white" />
              <h3 className="text-sm font-semibold text-white">Step 2 — Enter Verification Code</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>

            <input
              id="totp-verify-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full bg-[#000000] border border-[#262626] rounded-md px-4 py-3 text-xl text-white font-mono tracking-[0.5em] text-center focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
            />

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-md px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("idle"); setError(""); }}
                className="flex-1 border border-[#262626] text-neutral-400 hover:bg-neutral-800 hover:text-white py-2.5 text-sm font-semibold rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-enable-mfa-btn"
                onClick={() => verifyMutation.mutate()}
                disabled={token.length < 6 || verifyMutation.isPending}
                className="flex-1 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black py-2.5 text-sm font-semibold rounded-md transition-colors cursor-pointer"
              >
                {verifyMutation.isPending ? "Verifying…" : "Enable MFA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup codes */}
      {step === "backup" && backupCodes.length > 0 && (
        <div className="border border-amber-900/40 bg-amber-950/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">Save Your Backup Codes</h3>
          </div>
          <p className="text-xs text-amber-400/80">
            Store these codes somewhere safe. Each code can only be used <strong>once</strong> to recover your account if you lose access to your authenticator app.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code) => (
              <code
                key={code}
                className="font-mono text-sm text-white bg-neutral-900 border border-neutral-700 px-3 py-2 rounded-lg text-center tracking-widest"
              >
                {code}
              </code>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <CopyButton text={backupCodes.join("\n")} label="Copy all codes" />
          </div>

          <button
            id="mfa-done-btn"
            onClick={() => { setStep("idle"); setBackupCodes([]); }}
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 text-sm font-semibold rounded-lg transition-colors"
          >
            I've saved my backup codes — Done
          </button>
        </div>
      )}

      {/* What is MFA info card */}
      {step === "idle" && !isEnabled && (
        <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            How it works
          </h3>
          <div className="space-y-2 text-xs text-neutral-500">
            <p>✓ After signing in with your email, you'll be asked for a 6-digit code from your authenticator app.</p>
            <p>✓ The code changes every 30 seconds — even if your password is compromised, your account stays safe.</p>
            <p>✓ You'll get {8} one-time backup codes to use if you lose access to your authenticator app.</p>
            <p>✓ Compatible with Google Authenticator, Authy, Microsoft Authenticator, 1Password, and others.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MFAPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center gap-2 text-neutral-500 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading security settings…
        </div>
      }
    >
      <MFAContent />
    </Suspense>
  );
}
