'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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

  return (
    <div className="w-full max-w-md p-8 bg-neutral-900/80 border border-neutral-800 rounded-2xl shadow-2xl backdrop-blur-xl animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400">
          SOTS
        </h1>
        <p className="text-sm text-neutral-400 mt-2">
          State Observation & Tracking System
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-sm animate-shake">
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleIdentify} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Work Email Address
            </label>
            <input
              type="email"
              required
              disabled={isLoading}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Continue'
            )}
          </button>
        </form>
      ) : step === 2 ? (
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Verification Code
              </label>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition duration-150"
              >
                Change Email
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              We sent a 6-digit code to <span className="text-neutral-300 font-medium">{email}</span>.
            </p>

            <div className="flex gap-2 justify-between">
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
                  className="w-12 h-14 text-center text-xl font-bold bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-neutral-500">
            <span>
              Expires in: <span className="font-semibold text-neutral-300">{formatTime(expiryTimer)}</span>
            </span>

            {resendTimer > 0 ? (
              <span>Resend code in {resendTimer}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isLoading}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition duration-150"
              >
                Resend Code
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.some((d) => !d)}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              purpose === 'SIGNUP' ? 'Create Account' : 'Verify & Login'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordLogin} className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition duration-150"
              >
                Change Email
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Sign in to <span className="text-neutral-300 font-medium">{email}</span> with your account password.
            </p>
            <input
              type="password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign in with Password'
            )}
          </button>

          <button
            type="button"
            onClick={handleUseOtpInstead}
            disabled={isLoading}
            className="w-full text-center text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
          >
            Use email OTP instead
          </button>
        </form>
      )}
    </div>
  );
}
