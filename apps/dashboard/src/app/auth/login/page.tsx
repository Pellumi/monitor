'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Error humaniser ────────────────────────────────────────────────────────
type ErrorKind = 'network' | 'auth' | 'generic';

function humanizeError(raw: string): { title: string; detail: string; kind: ErrorKind } {
  const msg = raw.toLowerCase();

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
  const from = searchParams.get('from') || '/';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [purpose, setPurpose] = useState<'SIGNUP' | 'LOGIN'>('LOGIN');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timers
  const [resendTimer, setResendTimer] = useState(0);
  const [expiryTimer, setExpiryTimer] = useState(600); // 10 minutes

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

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
        throw new Error('Failed to resolve email. Please try again.');
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
    } catch (err: any) {
      setError(err.message);
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Password login failed. Try again.');
      }

      router.push(from);
    } catch (err: any) {
      setError(err.message);
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed. Try again.');
      }

      // Check if they need onboarding
      if (data.user.isNew) {
        router.push('/onboarding');
      } else {
        // Successful login, redirect to target
        router.push(from);
      }
    } catch (err: any) {
      setError(err.message);
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
  const errorInfo = error ? humanizeError(error) : null;

  return (
    <div className="w-full max-w-md p-6 md:p-8 bg-[#131313] border border-[#262626] rounded-md shadow-2xl animate-fade-in text-[#e2e2e2]">
      {/* Header bar matching auth-otp.html */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-6">
        <h1 className="text-xl font-extrabold tracking-tighter text-white uppercase font-sans">
          TELLANN
        </h1>
        <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
          {step === 1 ? 'AUTH // IDENTIFY' : step === 2 ? 'AUTH // VERIFICATION' : 'AUTH // PASSWORD'}
        </span>
      </div>

      {/* Title & Description */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          {step === 1 ? 'Sign in to Tellann' : step === 2 ? 'Verify your identity' : 'Enter your password'}
        </h2>
        <p className="text-sm text-[#c4c7c8] mt-1.5 leading-relaxed">
          {step === 1
            ? 'Enter your email address to continue to your workspace.'
            : step === 2
            ? <>We sent a 6-digit verification code to <span className="text-white font-medium">{email}</span>.</>
            : <>Sign in to <span className="text-white font-medium">{email}</span> with your account password.</>}
        </p>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {errorInfo && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-[#333] bg-[#000000] p-4 text-xs font-mono text-neutral-300 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-white">
              {errorInfo.kind === 'network' ? <IconWifi className="h-4 w-4 text-amber-400" /> : <IconAlertTriangle className="h-4 w-4 text-red-400" />}
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
                    setError(null);
                    void handleIdentify({ preventDefault: () => {} } as React.FormEvent);
                  }}
                  disabled={isLoading || !email}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-white underline underline-offset-2 transition hover:text-neutral-300 disabled:opacity-40"
                >
                  Try again
                </button>
              )}
            </div>

            <button
              onClick={() => setError(null)}
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

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-2.5 bg-white text-black font-semibold text-sm rounded-md hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              'Continue'
            )}
          </button>
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

          <button
            type="submit"
            disabled={isLoading || otp.some((d) => !d)}
            className="w-full py-2.5 bg-white text-black font-semibold text-sm rounded-md hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              purpose === 'SIGNUP' ? 'Create Account' : 'Verify & Login'
            )}
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

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-2.5 bg-white text-black font-semibold text-sm rounded-md hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              'Sign in with Password'
            )}
          </button>

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
