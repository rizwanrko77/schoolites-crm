'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email.trim()) {
      setError('Please enter your work email.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification code.');
      }

      setStep('otp');
      setSuccessMsg(data.message || 'If an account exists for this email, a verification code has been sent.');
      setResendCooldown(60);

      if (data.devOtp) {
        setDevOtp(data.devOtp);
      }

      // Focus first OTP box
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric characters
    const char = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    // Auto-advance to next input
    if (char && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the OTP.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: fullCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      // Successful login -> Navigate to target dashboard
      router.push(data.redirectUrl || '/admin/users');
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const autoFillDevOtp = () => {
    if (!devOtp || devOtp.length !== 6) return;
    const digits = devOtp.split('');
    setOtp(digits);
    otpInputsRef.current[5]?.focus();
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '24px',
        background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0a0d16 65%)',
      }}
    >
      {/* Decorative luminous background orbs */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          top: '-100px',
          right: '-100px',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(0, 0, 0, 0) 70%)',
          bottom: '-100px',
          left: '-100px',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-panel auth-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          position: 'relative',
          zIndex: 1,
          animation: 'slideUp 0.35s ease',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img
              src="/schoolites-logo.png"
              alt="Schoolites Logo"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
                background: '#ffffff',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              }}
            />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Schoolites Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Secure Unified Access for Teams & Partners
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && !error && (
          <div
            style={{
              background: 'var(--success-bg)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✉️</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Email Form */}
        {step === 'email' ? (
          <form onSubmit={handleSendOtp}>
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="email-input"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Work Email Address
              </label>
              <input
                id="email-input"
                type="email"
                autoComplete="email"
                placeholder="name@schoolites.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                disabled={isLoading}
                required
                autoFocus
              />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Enter the email address registered with your Schoolites account.
              </p>
            </div>

            <button
              id="send-otp-btn"
              type="submit"
              className="btn-primary"
              disabled={isLoading || !email.trim()}
              style={{ width: '100%', padding: '13px', marginTop: '6px' }}
            >
              {isLoading ? 'Generating Code...' : 'Send Verification Code →'}
            </button>

            {/* Quick Helper for initial testing */}
            <div
              style={{
                marginTop: '24px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed var(--border-subtle)',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              Default Seeded Admin: <strong style={{ color: 'var(--text-primary)' }}>admin@schoolites.com</strong>
            </div>
          </form>
        ) : (
          /* STEP 2: 6-Digit OTP Form */
          <form onSubmit={handleVerifyOtp}>
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Enter 6-Digit Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError('');
                    setSuccessMsg('');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    color: '#818cf8',
                    textDecoration: 'underline',
                  }}
                >
                  Change email
                </button>
              </div>

              {/* 6 input boxes */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  justifyContent: 'space-between',
                }}
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputsRef.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      maxWidth: '52px',
                      minWidth: '36px',
                      height: '52px',
                      textAlign: 'center',
                      fontSize: '1.35rem',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: digit ? '1px solid #818cf8' : '1px solid var(--border-subtle)',
                      boxShadow: digit ? '0 0 10px rgba(99, 102, 241, 0.25)' : 'none',
                      color: '#ffffff',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Dev helper badge if devOtp is available */}
            {devOtp && (
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: '#c7d2fe' }}>
                  🔑 Dev OTP: <strong style={{ color: '#ffffff', letterSpacing: '2px' }}>{devOtp}</strong>
                </span>
                <button
                  type="button"
                  onClick={autoFillDevOtp}
                  style={{
                    background: '#6366f1',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  Auto Fill
                </button>
              </div>
            )}

            <button
              id="verify-otp-btn"
              type="submit"
              className="btn-primary"
              disabled={isLoading || otp.join('').length !== 6}
              style={{ width: '100%', padding: '13px' }}
            >
              {isLoading ? 'Verifying...' : 'Sign In to Portal →'}
            </button>

            {/* Resend button */}
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              {resendCooldown > 0 ? (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Resend code in <strong style={{ color: 'var(--text-secondary)' }}>{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={isLoading}
                  style={{
                    fontSize: '0.82rem',
                    color: '#818cf8',
                    fontWeight: 600,
                  }}
                >
                  Didn't receive the code? Resend
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
