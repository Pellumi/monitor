'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { safeInternalPath } from '@/lib/safe-path';

// ─── Error humaniser ────────────────────────────────────────────────────────
type ErrorKind = 'network' | 'auth' | 'deleted' | 'generic';

/** Where users are told to write when an account is pending deletion. */
const SUPPORT_EMAIL = 'support@tellann.co';

function formatDeletionDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function humanizeError(
  raw: string,
  code?: string | null,
  scheduledFor?: string | null,
): { title: string; detail: string; kind: ErrorKind } {
  const msg = raw.toLowerCase();

  // Checked before the text heuristics below: this one is identified by its
  // code, and its wording must not be mistaken for a credentials problem.
  if (code === 'ACCOUNT_DELETION_PENDING') {
    const on = formatDeletionDate(scheduledFor ?? null);
    return {
      title: 'This account is scheduled for deletion',
      detail: on
        ? `Sign-in is blocked while deletion is pending. Your data is kept until ${on}, and only support can restore the account before then.`
        : 'Sign-in is blocked while deletion is pending. Your data is kept for 30 days from the request, and only support can restore the account before then.',
      kind: 'deleted',
    };
  }

  // Browser network errors when the server is completely unreachable
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('err_connection_refused') ||
    msg.includes('fetch error')
  ) {
    return {
      title: 'Unable to reach the server',
      detail: 'The Tellann backend appears to be offline or unreachable. Check your internet connection or contact your administrator if the problem persists.',
      kind: 'network',
    };
  }

  if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('wrong') || msg.includes('mismatch')) {
    return {
      title: 'Incorrect credentials',
      detail: raw,
      kind: 'auth',
    };
  }

  if (msg.includes('expired') || msg.includes('code')) {
    return {
      title: 'Code issue',
      detail: raw,
      kind: 'auth',
    };
  }

  return { title: 'Something went wrong', detail: raw, kind: 'generic' };
}

// ─── Icons (inline SVG to avoid extra imports) ───────────────────────────────
function IconWifi({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M8.5 16.5A5 5 0 0 1 12 15" />
      <path d="M5 12.5A9 9 0 0 1 12 10" />
      <path d="M2 9A13 13 0 0 1 12 5" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const desktopRequest = searchParams.get('desktopRequest');
  const inviteToken = searchParams.get('invite');
  // A plan chosen on the marketing site before signing in. Kept as a fallback
  // destination for links that predate `from`-carrying plan URLs. `free` is
  // excluded deliberately: there is nothing to pay for, so those visitors want
  // the product, not the billing page.
  const selectedPlan = searchParams.get('plan')?.toLowerCase();
  const paidPlan = selectedPlan && selectedPlan !== 'free' ? selectedPlan : null;
  const from =
    safeInternalPath(searchParams.get('from'))
    ?? (paidPlan ? `/settings/billing?plan=${encodeURIComponent(paidPlan)}` : '/');

  // 4 is the second-factor challenge, reached only when the account has MFA on.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mfaMethod, setMfaMethod] = useState<'TOTP' | 'EMAIL_OTP' | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaResent, setMfaResent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [purpose, setPurpose] = useState<'SIGNUP' | 'LOGIN'>('LOGIN');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Carried alongside the message so the banner can react to *which* error
  // this is rather than pattern-matching its wording.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [deletionScheduledFor, setDeletionScheduledFor] = useState<string | null>(null);
  const justScheduledDeletion = searchParams.get('account_deleted') === '1';

  // Timers
  const [resendTimer, setResendTimer] = useState(0);
  const [expiryTimer, setExpiryTimer] = useState(600); // 10 minutes

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * After a successful auth, attempt to claim any pending invite token.
   * On INVITE_EMAIL_MISMATCH the user is shown a clear error and NOT redirected.
   * On any other failure we still redirect — the invite can be retried later.
   */
  const claimInviteIfPresent = async (): Promise<{ claimed: boolean; orgId?: string }> => {
    if (!inviteToken) return { claimed: false };
    try {
      const res = await fetch('/api-gateway/organizations/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken }),
        credentials: 'include',
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'INVITE_EMAIL_MISMATCH') {
          throw new Error(
            `This invitation was sent to a different email address. Please sign in with the correct account or ask the organization owner to resend the invite.`,
          );
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Expired / already used — silently swallow and continue
        console.warn('[Invite] Non-fatal accept error:', data.error);
        return { claimed: false };
      }
      const data = await res.json();
      return { claimed: true, orgId: data.membership?.organizationId };
    } catch (err: any) {
      // Re-throw email mismatch so the UI can surface it; swallow the rest
      if (err.message.startsWith('This invitation')) throw err;
      console.warn('[Invite] Failed to claim invite:', err);
      return { claimed: false };
    }
  };

  const finishAuthentication = async (isNewUser = false) => {
    if (desktopRequest) {
      const completion = await fetch('/api-gateway/auth/desktop/authorize/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestToken: desktopRequest }),
      });
      if (!completion.ok) {
        const payload = await completion.json().catch(() => ({}));
        throw new Error(payload.message || 'Unable to authorize the Tellann desktop application.');
      }
      router.push('/auth/desktop-complete');
      return;
    }

    if (inviteToken) {
      // Claim the invite. This may throw on email mismatch.
      const { orgId } = await claimInviteIfPresent();
      // Redirect into the org workspace directly
      const dest = orgId ? `/?orgId=${orgId}` : '/';
      router.push(dest);
      return;
    }

    router.push(isNewUser ? '/onboarding' : from);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 2 && expiryTimer > 0) {
      interval = setInterval(() => {
        setExpiryTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, expiryTimer]);

  const sendOtp = async (cleanEmail: string, resolvedPurpose: 'SIGNUP' | 'LOGIN') => {
    const otpRes = await fetch('/api-gateway/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, purpose: resolvedPurpose }),
    });

    if (!otpRes.ok) {
      const errData = await otpRes.json();
      throw new Error(errData.message || 'Failed to send verification code.');
    }

    setStep(2);
    setResendTimer(60);
    setExpiryTimer(600);
  };

  /** Clears any banner, including the code that drove its presentation. */
  const clearError = () => {
    setError(null);
    setErrorCode(null);
    setDeletionScheduledFor(null);
  };

  /**
   * Surfaces what the API actually said. Previously every failed response was
   * flattened into one generic message, which hid cases like a pending account
   * deletion behind "Please try again".
   */
  const failFrom = async (res: Response, fallback: string): Promise<never> => {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || body.error || fallback), {
      code: typeof body.error === 'string' ? body.error : undefined,
      scheduledFor: typeof body.deletionScheduledFor === 'string' ? body.deletionScheduledFor : undefined,
    });
  };

  const applyError = (err: unknown, fallback: string) => {
    const detail = err as { message?: string; code?: string; scheduledFor?: string };
    setError(detail?.message || fallback);
    setErrorCode(detail?.code ?? null);
    setDeletionScheduledFor(detail?.scheduledFor ?? null);
  };

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // Step 1: Identify if user exists
      const res = await fetch('/api-gateway/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        await failFrom(res, 'Failed to resolve email. Please try again.');
      }

      const { exists, preferredAuthMode, hasPassword } = await res.json();
      const resolvedPurpose = exists ? 'LOGIN' : 'SIGNUP';
      setPurpose(resolvedPurpose);

      if (exists && preferredAuthMode === 'PASSWORD' && hasPassword) {
        setEmail(cleanEmail);
        setPassword('');
        setStep(3);
        return;
      }

      await sendOtp(cleanEmail, resolvedPurpose);
    } catch (err) {
      applyError(err, 'Failed to resolve email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      await sendOtp(email.trim().toLowerCase(), purpose);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api-gateway/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!res.ok) {
        await failFrom(res, 'Password login failed. Try again.');
      }
      const data = await res.json();

      // The password was right, but the account has a second factor. No session
      // exists yet — the challenge decides.
      if (data.mfaRequired) {
        setMfaMethod(data.method);
        setMfaCode('');
        setUseBackupCode(false);
        setStep(4);
        return;
      }

      await finishAuthentication(false);
    } catch (err) {
      applyError(err, 'Password login failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseOtpInstead = async () => {
    if (!email || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      await sendOtp(email.trim().toLowerCase(), 'LOGIN');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (/[^0-9]/.test(val)) return; // Only numbers allowed
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto focus next input
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const cleanedData = pastedData.replace(/[^0-9]/g, '');
    if (!cleanedData) return;

    const newOtp = [...otp];
    const startIndex = cleanedData.length === 6 ? 0 : index;

    for (let i = 0; i < 6 - startIndex; i++) {
      if (cleanedData[i] !== undefined) {
        newOtp[startIndex + i] = cleanedData[i];
      }
    }
    setOtp(newOtp);

    const focusIndex = Math.min(startIndex + cleanedData.length, 5);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api-gateway/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          purpose,
        }),
      });

      if (!res.ok) {
        await failFrom(res, 'Verification failed. Try again.');
      }
      const data = await res.json();

      if (data.mfaRequired) {
        setMfaMethod(data.method);
        setMfaCode('');
        setUseBackupCode(false);
        setStep(4);
        return;
      }

      await finishAuthentication(Boolean(data.user?.isNew));
    } catch (err) {
      applyError(err, 'Verification failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api-gateway/auth/mfa/challenge/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The challenge cookie is httpOnly, so it must ride along automatically.
        credentials: 'same-origin',
        body: JSON.stringify({ code: mfaCode.trim(), useBackupCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'That code was not accepted.');
      }
      await finishAuthentication(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code was not accepted.');
      setMfaCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaResend = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api-gateway/auth/mfa/challenge/resend', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send a new code.');
      }
      setMfaResent(true);
      window.setTimeout(() => setMfaResent(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new code.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  // Resolve friendly error info
  const errorInfo = error ? humanizeError(error, errorCode, deletionScheduledFor) : null;

  return (
    <div className="w-full max-w-md p-6 md:p-8 bg-[#131313] border border-[#262626] rounded-md shadow-2xl animate-fade-in text-[#e2e2e2]">
      {/* Header bar matching auth-otp.html */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-6">
        <h1 className="text-xl font-extrabold tracking-tighter text-white uppercase font-sans">
          TELLANN
        </h1>
        <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
          {step === 1
            ? 'AUTH // IDENTIFY'
            : step === 2
              ? 'AUTH // VERIFICATION'
              : step === 4
                ? 'AUTH // TWO-FACTOR'
                : 'AUTH // PASSWORD'}
        </span>
      </div>

      {/* Invite banner — shown on step 1 when there's a pending invite token */}
      {step === 1 && inviteToken && (
        <div className="mb-5 rounded-md border border-[#262626] bg-black px-4 py-3 font-mono text-xs text-[#e2e2e2]">
          <p className="font-semibold text-white mb-0.5">You have been invited</p>
          <p className="text-[#8e9192] leading-relaxed">
            Sign in or create an account with the email address the invitation was sent to. You'll be added to the organization automatically.
          </p>
        </div>
      )}

      {/* Title & Description */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          {step === 1
            ? (inviteToken ? 'Accept your invitation' : 'Sign in to Tellann')
            : step === 2
              ? 'Verify your identity'
              : step === 4
                ? 'Two-factor authentication'
                : 'Enter your password'}
        </h2>
        <p className="text-sm text-[#c4c7c8] mt-1.5 leading-relaxed">
          {step === 1
            ? (inviteToken ? 'Enter the email address the invitation was sent to.' : 'Enter your email address to continue to your workspace.')
            : step === 2
            ? <>We sent a 6-digit verification code to <span className="text-white font-medium">{email}</span>.</>
            : <>Sign in to <span className="text-white font-medium">{email}</span> with your account password.</>}
        </p>
      </div>

      {/* Shown once, straight after scheduling deletion. */}
      {justScheduledDeletion && !errorInfo && (
        <div
          role="status"
          className="mb-6 rounded-md border border-[#333] bg-[#000000] p-4 text-xs font-mono text-neutral-300"
        >
          <p className="font-semibold text-white leading-snug">Account deletion scheduled</p>
          <p className="mt-1 leading-relaxed text-neutral-400">
            Your account has been scheduled for deletion and cannot be accessed again, you can proceed to contact our support if this request was not made by you.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Account restoration request')}`}
            className="mt-2.5 inline-block text-xs font-medium text-white underline underline-offset-2 transition hover:text-neutral-300"
          >
            Contact support ({SUPPORT_EMAIL})
          </a>
        </div>
      )}

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {errorInfo && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-[#333] bg-[#000000] p-4 text-xs font-mono text-neutral-300 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-white">
              {errorInfo.kind === 'network' ? (
                <IconWifi className="h-4 w-4 text-amber-400" />
              ) : (
                <IconAlertTriangle
                  className={errorInfo.kind === 'deleted' ? 'h-4 w-4 text-amber-400' : 'h-4 w-4 text-red-400'}
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white leading-snug">{errorInfo.title}</p>
              <p className="mt-1 text-neutral-400 leading-relaxed">
                {errorInfo.detail}
              </p>

              {errorInfo.kind === 'network' && step === 1 && (
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    void handleIdentify({ preventDefault: () => {} } as React.FormEvent);
                  }}
                  disabled={isLoading || !email}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-white underline underline-offset-2 transition hover:text-neutral-300 disabled:opacity-40"
                >
                  Try again
                </button>
              )}

              {/* Retrying cannot help here — the only way forward is support. */}
              {errorInfo.kind === 'deleted' && (
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Account restoration request')}&body=${encodeURIComponent(`Please restore my account: ${email}`)}`}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-white underline underline-offset-2 transition hover:text-neutral-300"
                >
                  Contact support ({SUPPORT_EMAIL})
                </a>
              )}
            </div>

            <button
              onClick={clearError}
              className="shrink-0 text-neutral-500 hover:text-white p-0.5 transition cursor-pointer"
              aria-label="Dismiss error"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleIdentify} className="space-y-5">
          <div>
            <label className="block text-xs font-mono font-medium text-[#8e9192] uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              disabled={isLoading}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#262626] rounded-md text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-sm transition duration-150"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading || !email}
            loading={isLoading}
            className="w-full"
          >
            Continue
          </Button>
        </form>
      ) : step === 2 ? (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-mono font-medium text-[#8e9192] uppercase tracking-wider">
                Verification Code
              </label>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-mono text-[#8e9192] hover:text-white transition duration-150 underline underline-offset-2"
              >
                Change Email
              </button>
            </div>

            <div className="flex gap-2 justify-between my-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={1}
                  required
                  disabled={isLoading}
                  value={digit}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={(e) => handleOtpPaste(e, i)}
                  className="w-12 h-14 text-center text-xl font-bold font-mono bg-[#000000] border border-[#262626] rounded-md text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                />
              ))}
            </div>
          </div>

          {/* Monospace details box matching auth-otp.html style */}
          <div className="bg-[#000000] border border-[#262626] rounded-md divide-y divide-[#262626] font-mono text-xs">
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-[#8e9192] tracking-wider uppercase text-[11px]">Expires in</span>
              <span className="text-white font-medium">{formatTime(expiryTimer)}</span>
            </div>
            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-[#8e9192] tracking-wider uppercase text-[11px]">Resend Status</span>
              {resendTimer > 0 ? (
                <span className="text-neutral-400 text-xs">Resend in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-white hover:underline text-xs font-medium transition cursor-pointer"
                >
                  Resend Code
                </button>
              )}
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading || otp.some((d) => !d)}
            loading={isLoading}
            className="w-full"
          >
            {purpose === 'SIGNUP' ? 'Create Account' : 'Verify & Login'}
          </Button>
        </form>
      ) : step === 4 ? (
        <form onSubmit={handleMfaVerify} className="space-y-5">
          <p className="text-xs text-[#8e9192] leading-5">
            {useBackupCode
              ? 'Enter one of the backup codes you saved when you turned on two-factor authentication.'
              : mfaMethod === 'EMAIL_OTP'
                ? `We sent a 6-digit code to ${email}. Enter it below to finish signing in.`
                : 'Open your authenticator app and enter the 6-digit code shown for Tellann.'}
          </p>

          <div>
            <label className="block text-xs font-mono font-medium text-[#8e9192] uppercase tracking-wider mb-2">
              {useBackupCode ? 'Backup Code' : 'Authentication Code'}
            </label>
            <input
              autoFocus
              type="text"
              inputMode={useBackupCode ? 'text' : 'numeric'}
              autoComplete={useBackupCode ? 'off' : 'one-time-code'}
              maxLength={useBackupCode ? 8 : 6}
              disabled={isLoading}
              value={mfaCode}
              onChange={(e) =>
                setMfaCode(
                  useBackupCode
                    ? e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '')
                    : e.target.value.replace(/\D/g, ''),
                )
              }
              placeholder={useBackupCode ? 'A1B2C3D4' : '000000'}
              className="w-full px-3.5 py-3 bg-[#000000] border border-[#262626] rounded-md text-white text-center font-mono text-xl tracking-[0.4em] placeholder-neutral-700 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition duration-150"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading || mfaCode.length < (useBackupCode ? 8 : 6)}
            loading={isLoading}
            className="w-full"
          >
            Verify &amp; Sign in
          </Button>

          {mfaMethod === 'EMAIL_OTP' && !useBackupCode ? (
            <button
              type="button"
              onClick={handleMfaResend}
              disabled={isLoading}
              className="w-full text-center text-xs font-mono text-[#8e9192] hover:text-white transition duration-150 underline underline-offset-2 disabled:opacity-50"
            >
              {mfaResent ? 'New code sent' : 'Send a new code'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => { setUseBackupCode(!useBackupCode); setMfaCode(''); setError(null); }}
            disabled={isLoading}
            className="w-full text-center text-xs font-mono text-[#8e9192] hover:text-white transition duration-150 underline underline-offset-2 disabled:opacity-50"
          >
            {useBackupCode ? 'Use my authenticator instead' : 'Use a backup code instead'}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordLogin} className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-mono font-medium text-[#8e9192] uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-mono text-[#8e9192] hover:text-white transition duration-150 underline underline-offset-2"
              >
                Change Email
              </button>
            </div>
            <input
              type="password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#000000] border border-[#262626] rounded-md text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white text-sm transition duration-150"
              placeholder="Enter your password"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading || !password}
            loading={isLoading}
            className="w-full"
          >
            Sign in with Password
          </Button>

          <button
            type="button"
            onClick={handleUseOtpInstead}
            disabled={isLoading}
            className="w-full text-center text-xs font-mono text-[#8e9192] hover:text-white transition duration-150 underline underline-offset-2 disabled:opacity-50"
          >
            Use email OTP instead
          </button>
        </form>
      )}
    </div>
  );
}
