"use client";
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
      <div className="w-full space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-56 animate-pulse rounded-md bg-neutral-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-neutral-800/60" />
        </div>
        <div className="h-20 w-full animate-pulse rounded-xl border border-neutral-800 bg-neutral-900" />
      </div>
    );
  }

  const isEnabled = mfaStatus?.totpEnabled ?? false;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isEnabled ? "bg-emerald-500/10" : "bg-neutral-800"}`}>
          {isEnabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          ) : (
            <Shield className="h-5 w-5 text-neutral-400" />
          )}
        </div> */}
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
          <Button
            id="setup-mfa-btn"
            variant="primary"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            loading={setupMutation.isPending}
          >
            {!setupMutation.isPending && <Shield className="h-3.5 w-3.5" />}
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
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setShowDisable(false); setDisableToken(""); setError(""); }}
            >
              Cancel
            </Button>
            <Button
              id="confirm-disable-mfa-btn"
              variant="danger"
              className="flex-1"
              onClick={() => disableMutation.mutate()}
              disabled={disableToken.length < 6 || disableMutation.isPending}
              loading={disableMutation.isPending}
            >
              Confirm Disable
            </Button>
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

          <Button
            id="mfa-done-btn"
            variant="primary"
            className="w-full font-bold uppercase tracking-wider text-xs h-10 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white"
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
            <p>✓ Compatible with Google Authenticator, Authy, Microsoft Authenticator, 1Password, and others.</p>
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

function AccountDeletionContent() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    setSubmitting(true); setError('');
    const response = await authenticatedFetch(`${AUTH_API}/account/deletion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationPhrase: phrase, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.message || body.error || 'Deletion could not be scheduled.'); setSubmitting(false); return; }
    window.location.href = '/auth/login?account_deleted=1';
  }
  return (
    <SettingsSection title="Delete account" description="Permanently remove your account and organizations you solely own.">
      <div className="rounded-lg border border-red-900/50 bg-red-950/10 p-4">
        <p className="text-sm text-neutral-300">Access is blocked immediately. Product data is retained for 30 days, during which restoration is available only through support. Required financial records are retained in anonymized form.</p>
        {!open ? <Button type="button" variant="danger" className="mt-4" onClick={() => setOpen(true)}>Delete my account</Button> : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-neutral-400">Type <span className="font-mono text-red-300">DELETE MY ACCOUNT</span></label>
            <input value={phrase} onChange={(event) => setPhrase(event.target.value)} className="w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white" />
            <label className="block text-xs text-neutral-400">Confirm with your password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white" />
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="danger" disabled={phrase !== 'DELETE MY ACCOUNT' || !password || submitting} onClick={() => void submit()}>{submitting ? 'Scheduling…' : 'Schedule deletion'}</Button></div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

export default function SecurityPage() {
  return (
    <SettingsPage title="Security & Sessions" description="Manage authentication, MFA, active devices, and enterprise identity controls." scope="USER">
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
