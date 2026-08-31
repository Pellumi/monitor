"use client";
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useSession } from '@/components/providers';

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Key,
  Copy,
  CheckCircle,
  AlertTriangle,
  QrCode,
  ChevronDown,
  Monitor,
  LogOut,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { SettingsPage, SettingsSection, UpgradeNotice } from "@/components/settings/settings-page";

const AUTH_API = "/api-gateway/auth";

// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors h-auto p-0"
    >
      {copied ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MFAContent() {
  const [step, setStep] = useState<"idle" | "choose" | "setup" | "email" | "backup">("idle");
  const [secretBase32, setSecretBase32] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
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
  } = useQuery<{
    totpEnabled: boolean;
    mfaMethod: "NONE" | "TOTP" | "EMAIL_OTP";
    mfaEnabled: boolean;
    backupCodesRemaining: number;
  }>({
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
      return res.json() as Promise<{ secret: string; uri: string; qrDataUrl: string }>;
    },
    onSuccess: (data) => {
      setSecretBase32(data.secret);
      setQrDataUrl(data.qrDataUrl);
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
        body: JSON.stringify({ token }),
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

  // Email-code method: request a code, then confirm it.
  const emailSendMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/email/send`, { method: "POST" });
      if (!res.ok) throw new Error("Could not send a code to your email");
      return res.json();
    },
    onSuccess: () => { setStep("email"); setError(""); },
    onError: (err: Error) => setError(err.message || "Could not send code"),
  });

  const emailEnableMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/email/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "That code was not accepted");
      }
      return res.json() as Promise<{ backupCodes: string[] }>;
    },
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setEmailCode("");
      setStep("backup");
      setError("");
      void refetchStatus();
    },
    onError: (err: Error) => setError(err.message || "Invalid code"),
  });

  // Disable MFA
  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${AUTH_API}/mfa/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: disableToken, password: disablePassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to disable MFA");
      }
    },
    onSuccess: () => {
      setShowDisable(false);
      setDisableToken("");
      setDisablePassword("");
      setStep("idle");
      setError("");
      void refetchStatus();
    },
    onError: (err: any) => setError(err?.message ?? "Invalid token"),
  });

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-56 animate-pulse rounded-md bg-neutral-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-neutral-800/60" />
        </div>
        <div className="h-20 w-full animate-pulse rounded-xl border border-neutral-800 bg-neutral-900" />
      </div>
    );
  }

  const isEnabled = mfaStatus?.mfaEnabled ?? mfaStatus?.totpEnabled ?? false;
  const method = mfaStatus?.mfaMethod ?? "NONE";
  const methodLabel = method === "TOTP" ? "Authenticator App" : method === "EMAIL_OTP" ? "Email Code" : "";

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
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
          {/* {isEnabled ? (
            <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
          )} */}
          <div>
            <p className={`text-sm font-semibold ${isEnabled ? "text-emerald-300" : "text-amber-300"}`}>
              {isEnabled ? `MFA Enabled (${methodLabel})` : "MFA Not Configured"}
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
          <Button
            id="setup-mfa-btn"
            variant="primary"
            onClick={() => { setStep("choose"); setError(""); }}
          >
            Enable MFA
          </Button>
        )}

        {isEnabled && (
          <Button
            id="disable-mfa-btn"
            variant="secondary"
            size="sm"
            onClick={() => setShowDisable(!showDisable)}
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Disable
          </Button>
        )}
      </div>

      {/* Disable confirmation */}
      {showDisable && isEnabled && (
        <div className="border border-red-900/30 bg-red-950/10 rounded-md p-4 space-y-3">
          <p className="text-sm font-semibold text-red-300">Disable Two-Factor Authentication</p>
          <p className="text-xs text-neutral-400">
            Disabling MFA makes your account less secure. Confirm it is you before we turn it off.
          </p>

          {method === "EMAIL_OTP" ? (
            <button
              type="button"
              onClick={() => emailSendMutation.mutate()}
              disabled={emailSendMutation.isPending}
              className="text-xs text-[#8e9192] underline underline-offset-2 hover:text-white disabled:opacity-50"
            >
              Email me a confirmation code
            </button>
          ) : null}

          <input
            id="disable-totp-input"
            type="text"
            inputMode="text"
            maxLength={8}
            value={disableToken}
            onChange={(e) => setDisableToken(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))}
            placeholder={method === "EMAIL_OTP" ? "Emailed code" : "123456"}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-[0.3em] text-center focus:outline-none focus:border-red-500"
          />
          <p className="text-center text-[11px] text-neutral-500">
            {method === "EMAIL_OTP"
              ? "Enter the emailed code, or one of your backup codes."
              : "Enter the code from your authenticator app, or one of your backup codes."}
          </p>

          {/* A lost authenticator must not trap the user: the password works too. */}
          <div className="border-t border-red-900/20 pt-3">
            <label className="mb-1.5 block text-[11px] text-neutral-500">
              Lost access to your codes? Confirm with your password instead.
            </label>
            <input
              id="disable-password-input"
              type="password"
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Account password"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setShowDisable(false); setDisableToken(""); setDisablePassword(""); setError(""); }}
            >
              Cancel
            </Button>
            <Button
              id="confirm-disable-mfa-btn"
              variant="danger"
              className="flex-1"
              onClick={() => disableMutation.mutate()}
              disabled={(disableToken.length < 6 && disablePassword.length === 0) || disableMutation.isPending}
              loading={disableMutation.isPending}
            >
              Confirm Disable
            </Button>
          </div>
        </div>
      )}

      {/* Choose a second factor */}
      {step === "choose" && !isEnabled && (
        <div className="border border-[#262626] bg-[#131313] rounded-md p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Choose your second factor</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              className="rounded-md border border-[#262626] bg-black p-4 text-left transition-colors hover:border-neutral-600 disabled:opacity-50"
            >
              <span className="block text-sm font-semibold text-white">Authenticator app</span>
              <span className="mt-1 block text-xs leading-5 text-[#8e9192]">
                Google Authenticator, Authy, or Microsoft Authenticator. Works without a network
                connection and is the stronger option.
              </span>
            </button>
            <button
              type="button"
              onClick={() => emailSendMutation.mutate()}
              disabled={emailSendMutation.isPending}
              className="rounded-md border border-[#262626] bg-black p-4 text-left transition-colors hover:border-neutral-600 disabled:opacity-50"
            >
              <span className="block text-sm font-semibold text-white">Email code</span>
              <span className="mt-1 block text-xs leading-5 text-[#8e9192]">
                A code is sent to your address at every sign-in. Simpler, but only adds protection when
                you sign in with a password.
              </span>
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-900/30 bg-red-950/20 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <Button variant="secondary" onClick={() => { setStep("idle"); setError(""); }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Confirm the emailed code */}
      {step === "email" && (
        <div className="border border-[#262626] bg-[#131313] rounded-md p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-white" />
            <h3 className="text-sm font-semibold text-white">Confirm your email code</h3>
          </div>
          <p className="text-xs text-neutral-400">
            We sent a 6-digit code to your account email. Enter it to turn on two-factor
            authentication.
          </p>
          <input
            id="mfa-email-code-input"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full rounded-md border border-[#262626] bg-[#000000] px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
          />
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-900/30 bg-red-950/20 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setStep("choose"); setEmailCode(""); setError(""); }}>
              Back
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => emailEnableMutation.mutate()}
              disabled={emailCode.length < 6 || emailEnableMutation.isPending}
              loading={emailEnableMutation.isPending}
            >
              Enable MFA
            </Button>
          </div>
          <button
            type="button"
            onClick={() => emailSendMutation.mutate()}
            disabled={emailSendMutation.isPending}
            className="w-full text-center text-xs text-[#8e9192] underline underline-offset-2 hover:text-white disabled:opacity-50"
          >
            Send a new code
          </button>
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
              Scan this QR code with Google Authenticator, Authy, or Microsoft Authenticator
              (1Password and other TOTP apps work too).
            </p>

            {/*
              Rendered by auth-api and delivered as a data: URL. The otpauth URI
              embeds the shared secret, so it must never be handed to a
              third-party image service.
            */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-md inline-block">
                {qrDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrDataUrl}
                    alt="QR code for adding Tellann to your authenticator app"
                    width={200}
                    height={200}
                    className="block h-[200px] w-[200px]"
                  />
                ) : (
                  <div className="h-[200px] w-[200px] animate-pulse bg-neutral-200" />
                )}
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
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setStep("idle"); setError(""); }}
              >
                Cancel
              </Button>
              <Button
                id="confirm-enable-mfa-btn"
                variant="primary"
                className="flex-1"
                onClick={() => verifyMutation.mutate()}
                disabled={token.length < 6 || verifyMutation.isPending}
                loading={verifyMutation.isPending}
              >
                Enable MFA
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Backup codes */}
      {step === "backup" && backupCodes.length > 0 && (
        <div className="border border-[#262626] bg-[#131313] rounded-md p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-white" />
            <h3 className="text-sm font-semibold text-white">Save your backup codes</h3>
          </div>
          <p className="text-xs text-[#8e9192] leading-5">
            Store these codes somewhere safe. Each code can only be used <strong className="text-white font-semibold">once</strong> to recover your account if you lose access to your second factor.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code) => (
              <code
                key={code}
                className="font-mono text-sm text-white bg-black border border-[#262626] px-3 py-2 rounded text-center tracking-widest"
              >
                {code}
              </code>
            ))}
          </div>

          <div className="flex gap-3 pt-1">
            <CopyButton text={backupCodes.join("\n")} label="Copy all codes" />
          </div>

          <Button
            id="mfa-done-btn"
            variant="primary"
            className="w-full"
            onClick={() => { setStep("idle"); setBackupCodes([]); }}
          >
            I've saved my backup codes — Done
          </Button>
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
            <p>✓ Works with Google Authenticator, Authy, Microsoft Authenticator, 1Password, and others.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SecuritySettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading security settings">
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-neutral-800 rounded-lg" />
            <div className="space-y-2">
              <div className="h-5 w-48 bg-neutral-800 rounded" />
              <div className="h-3 w-64 bg-neutral-800/60 rounded" />
            </div>
          </div>
          <div className="h-8 w-24 bg-neutral-800 rounded-md" />
        </div>
        <div className="pt-4 border-t border-[#262626] flex gap-3">
          <div className="h-9 w-32 bg-neutral-800 rounded-md" />
          <div className="h-9 w-28 bg-neutral-800/60 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-6 space-y-4">
        <div className="h-5 w-40 bg-neutral-800 rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-neutral-800/40 rounded" />
          <div className="h-4 w-5/6 bg-neutral-800/40 rounded" />
        </div>
      </div>
    </div>
  );
}

function MFASettingsContent() {
  return (
    <Suspense fallback={<SecuritySettingsSkeleton />}>
      <MFAContent />
    </Suspense>
  );
}

type UserSession = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

function SessionsContent() {
  const sessions = useQuery<UserSession[]>({
    queryKey: ["auth-sessions"],
    queryFn: async () => {
      const response = await authenticatedFetch(`${AUTH_API}/sessions`);
      if (!response.ok) throw new Error("Failed to load active sessions");
      return response.json();
    },
  });

  async function revoke(id: string) {
    const response = await authenticatedFetch(`${AUTH_API}/sessions/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to revoke session");
    await sessions.refetch();
  }

  async function revokeOthers() {
    const response = await authenticatedFetch(`${AUTH_API}/sessions`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to revoke other sessions");
    await sessions.refetch();
  }

  return (
    <SettingsSection title="Active sessions" description="Devices currently signed in to your Tellann account.">
      <div className="divide-y divide-neutral-800">
        {(sessions.data ?? []).map((session) => (
          <div key={session.id} className="flex items-start justify-between gap-4 py-4">
            <div className="flex gap-3">
              <Monitor className="mt-0.5 h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-sm font-medium text-neutral-200">
                  {session.userAgent || "Unknown browser"}
                  {session.current ? <span className="ml-2 text-xs text-emerald-400">Current session</span> : null}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {session.ipAddress || "Unknown network"} · Started {new Date(session.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            {!session.current ? (
              <Button
                type="button"
                variant="danger"
                size="xs"
                onClick={() => void revoke(session.id)}
              >
                Revoke
              </Button>
            ) : null}
          </div>
        ))}
        {sessions.isLoading ? <p className="py-4 text-sm text-neutral-500">Loading sessions…</p> : null}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void revokeOthers()}
        className="mt-4"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out all other sessions
      </Button>
    </SettingsSection>
  );
}

type DesktopDevice = {
  id: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

function DesktopDevicesContent() {
  const devices = useQuery<DesktopDevice[]>({
    queryKey: ["desktop-devices"],
    queryFn: async () => {
      const response = await authenticatedFetch(`${AUTH_API}/desktop/devices`);
      if (!response.ok) throw new Error("Failed to load desktop devices");
      return response.json();
    },
  });

  async function revoke(id: string) {
    const response = await authenticatedFetch(`${AUTH_API}/desktop/devices/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to revoke desktop device");
    await devices.refetch();
  }

  return (
    <SettingsSection title="Tellann Desktop devices" description="Device-bound desktop sessions. Revocation immediately blocks refresh and cloud synchronization.">
      <div className="divide-y divide-neutral-800">
        {(devices.data ?? []).map((device) => (
          <div key={device.id} className="flex items-start justify-between gap-4 py-4">
            <div className="flex gap-3">
              <Monitor className="mt-0.5 h-4 w-4 text-neutral-500" />
              <div>
                <div className="text-sm font-medium text-neutral-200">
                  {device.deviceName}
                  {device.revokedAt ? <span className="ml-2 text-xs text-red-400">Revoked</span> : null}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {device.platform} · Tellann {device.appVersion} · Last seen {new Date(device.lastSeenAt).toLocaleString()}
                </div>
              </div>
            </div>
            {!device.revokedAt ? <Button type="button" variant="danger" size="xs" onClick={() => void revoke(device.id)}>Revoke</Button> : null}
          </div>
        ))}
        {devices.isLoading ? <p className="py-4 text-sm text-neutral-500">Loading desktop devices…</p> : null}
        {!devices.isLoading && !devices.data?.length ? <p className="py-4 text-sm text-neutral-500">No desktop devices connected.</p> : null}
      </div>
    </SettingsSection>
  );
}

/**
 * Choosing the first factor: an emailed one-time code, or a password.
 *
 * Switching to password requires one to exist, so the form can set it in the
 * same step. The API accepts `preferredAuthMode` alongside a new password,
 * which avoids the dead end of selecting a mode the account cannot use.
 */
function SignInMethodContent() {
  const { user, refetch: refetchSession } = useSession();
  const currentMode = user?.preferredAuthMode ?? "OTP";
  const hasPassword = user?.hasPassword ?? false;

  const [mode, setMode] = useState<"OTP" | "PASSWORD">(currentMode);
  const [pickedMode, setPickedMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Password complexity checks
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
  const allRequirementsMet = hasUppercase && hasLowercase && hasNumber && hasSymbol;

  // The session loads after the first render, so adopt its value until the user
  // makes a choice of their own.
  const selectedMode = pickedMode ? mode : currentMode;
  const needsPasswordFirst = selectedMode === "PASSWORD" && !hasPassword;
  const modeChanged = selectedMode !== currentMode;

  function choose(next: "OTP" | "PASSWORD") {
    setMode(next);
    setPickedMode(true);
    setNotice(null);
  }

  async function saveMode() {
    setSaving(true);
    setNotice(null);
    try {
      const res = await authenticatedFetch(`${AUTH_API}/preferred-auth-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredAuthMode: selectedMode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Could not update sign-in method");
      await refetchSession();
      setPickedMode(false);
      setNotice({
        kind: "ok",
        text: selectedMode === "OTP"
          ? "You will sign in with a code emailed to you."
          : "You will sign in with your password.",
      });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (!allRequirementsMet) {
      setNotice({ kind: "error", text: "Password does not meet complexity requirements." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ kind: "error", text: "The two passwords do not match." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await authenticatedFetch(`${AUTH_API}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
          // Setting a password and choosing it as the sign-in method is one
          // action from the user's point of view.
          preferredAuthMode: selectedMode,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? body.error ?? "Could not save password");
      await refetchSession();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setPickedMode(false);
      setNotice({ kind: "ok", text: hasPassword ? "Password updated." : "Password set." });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setSaving(false);
    }
  }

  const options: Array<{ value: "OTP" | "PASSWORD"; title: string; body: string }> = [
    {
      value: "OTP",
      title: "Email one-time code",
      body: "We email a 6-digit code each time you sign in. Nothing to remember.",
    },
    {
      value: "PASSWORD",
      title: "Email and password",
      body: "Sign in with a password you choose. Faster, but you have to keep it safe.",
    },
  ];

  return (
    <SettingsSection
      title="Sign-in method"
      description="How you prove who you are when signing in. Two-factor authentication, if enabled, applies on top of this."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = selectedMode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option.value)}
              className={`rounded-md border p-4 text-left transition-colors ${
                selected ? "border-white bg-[#131313]" : "border-[#262626] bg-black hover:border-neutral-600"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{option.title}</span>
                {option.value === currentMode ? (
                  <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
                    Current
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[#8e9192]">{option.body}</span>
            </button>
          );
        })}
      </div>

      {needsPasswordFirst ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Set a password below before switching to this method.
        </p>
      ) : null}

      {notice ? (
        <p className={`mt-3 text-xs ${notice.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {notice.text}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={!modeChanged || needsPasswordFirst || saving}
          onClick={() => void saveMode()}
        >
          Save sign-in method
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowPasswordForm(!showPasswordForm)}>
          {hasPassword ? "Change password" : "Set a password"}
        </Button>
      </div>

      {showPasswordForm ? (
        <div className="mt-4 space-y-3 rounded-md border border-[#262626] bg-[#131313] p-4">
          {hasPassword ? (
            <div>
              <label htmlFor="current-password" className="mb-1.5 block text-xs text-neutral-400">
                Current password
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md border border-[#262626] bg-black pl-3 pr-10 py-2 text-sm text-white focus:border-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : null}
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-xs text-neutral-400">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-[#262626] bg-black pl-3 pr-10 py-2 text-sm text-white focus:border-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Visual requirement indicators */}
            <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-md border border-[#262626] bg-black p-2.5">
              <RequirementItem met={hasUppercase} label="Uppercase character (A-Z)" />
              <RequirementItem met={hasLowercase} label="Lowercase character (a-z)" />
              <RequirementItem met={hasNumber} label="Number character (0-9)" />
              <RequirementItem met={hasSymbol} label="Symbol character (!@#...)" />
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-xs text-neutral-400">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-[#262626] bg-black pl-3 pr-10 py-2 text-sm text-white focus:border-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword ? (
              <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>
            ) : null}
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowPasswordForm(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              disabled={!allRequirementsMet || !newPassword || !confirmPassword || newPassword !== confirmPassword || (hasPassword && !currentPassword) || saving}
              onClick={() => void savePassword()}
            >
              {hasPassword ? "Update password" : "Set password"}
            </Button>
          </div>
        </div>
      ) : null}
    </SettingsSection>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? (
        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
      )}
      <span className={met ? "text-neutral-200 font-medium" : "text-neutral-500"}>{label}</span>
    </div>
  );
}

function AccountDeletionContent() {
  const { user } = useSession();
  // Someone who signs in with an emailed code may well have no password at all,
  // so the confirmation has to match how they actually authenticate.
  const canUsePassword = user?.hasPassword ?? false;
  const prefersOtp = (user?.preferredAuthMode ?? 'OTP') === 'OTP';

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'PASSWORD' | 'OTP' | null>(null);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Default to the method the account is set up for, once the session is known.
  const activeMethod = method ?? (prefersOtp || !canUsePassword ? 'OTP' : 'PASSWORD');
  const confirmed = activeMethod === 'PASSWORD' ? password.length > 0 : otpCode.length === 6;

  function reset() {
    setOpen(false);
    setMethod(null);
    setPhrase('');
    setPassword('');
    setOtpCode('');
    setOtpSent(false);
    setError('');
  }

  async function sendOtp() {
    if (!user?.email) return;
    setSendingOtp(true);
    setError('');
    try {
      const response = await authenticatedFetch(`${AUTH_API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, purpose: 'ACCOUNT_DELETION' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Could not send a code.');
      }
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a code.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    const response = await authenticatedFetch(`${AUTH_API}/account/deletion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationPhrase: phrase,
        ...(activeMethod === 'PASSWORD' ? { password } : { otpCode }),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.message || body.error || 'Deletion could not be scheduled.');
      setSubmitting(false);
      return;
    }
    window.location.href = '/auth/login?account_deleted=1';
  }

  return (
    <SettingsSection title="Delete account" description="Permanently remove your account and organizations you solely own.">
      <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-4">
        <p className="text-sm text-neutral-300">Access is blocked immediately. Product data is retained for 30 days, during which restoration is available only through support. Required financial records are retained in anonymized form.</p>
        {!open ? (
          <Button type="button" variant="danger" className="mt-4" onClick={() => setOpen(true)}>Delete my account</Button>
        ) : (
          <div className="mt-4 space-y-3">
            <label htmlFor="delete-phrase" className="block text-xs text-neutral-400">
              Type <span className="font-mono text-red-300">DELETE MY ACCOUNT</span>
            </label>
            <input
              id="delete-phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
            />

            {/* Both confirmations are offered when the account supports both. */}
            {canUsePassword ? (
              <div className="pt-1">
                <Switch
                  checked={activeMethod === 'PASSWORD'}
                  onCheckedChange={(checked) => {
                    setMethod(checked ? 'PASSWORD' : 'OTP');
                    setError('');
                  }}
                  labels={["Emailed code", "Password"]}
                />
              </div>
            ) : null}

            {activeMethod === 'PASSWORD' ? (
              <>
                <label htmlFor="delete-password" className="block text-xs text-neutral-400">Confirm with your password</label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                />
              </>
            ) : (
              <>
                <label htmlFor="delete-otp" className="block text-xs text-neutral-400">
                  Confirm with a code emailed to {user?.email ?? 'your address'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="delete-otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-center font-mono text-sm tracking-[0.3em] text-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={sendingOtp}
                    loading={sendingOtp}
                    onClick={() => void sendOtp()}
                  >
                    {otpSent ? 'Resend' : 'Send code'}
                  </Button>
                </div>
                {otpSent ? (
                  <p className="text-xs text-neutral-500">Code sent. It expires in 10 minutes.</p>
                ) : null}
              </>
            )}

            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
              <Button
                type="button"
                variant="danger"
                disabled={phrase !== 'DELETE MY ACCOUNT' || !confirmed || submitting}
                loading={submitting}
                onClick={() => void submit()}
              >
                {submitting ? 'Scheduling…' : 'Schedule deletion'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

export default function SecurityPage() {
  return (
    <SettingsPage title="Security & Sessions" description="Manage authentication, MFA, active devices, and enterprise identity controls." scope="USER">
      <SignInMethodContent />
      <MFASettingsContent />
      <SessionsContent />
      <DesktopDevicesContent />
      <AccountDeletionContent />
      <SettingsSection title="Enterprise SSO" description="SAML, OIDC, domain verification, and identity-provider policies.">
        <UpgradeNotice>SSO configuration is available on Enterprise. Personal security and MFA remain available on every plan.</UpgradeNotice>
      </SettingsSection>
    </SettingsPage>
  );
}
