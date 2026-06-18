'use client';

import { useState, useMemo } from 'react';

interface AuthFormProps {
  onSuccess: (user: { username: string; email?: string }) => void;
}

type AuthMode = 'login' | 'register' | 'verify-otp' | 'locked' | 'unlock-otp';

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockEmail, setLockEmail] = useState('');

  // Real-time password validation
  const passwordRules = useMemo(() => {
    if (mode !== 'register') return [];
    return [
      { label: 'At least 8 characters', valid: password.length >= 8 },
      { label: 'Contains a number', valid: /\d/.test(password) },
      { label: 'Contains a special character', valid: /[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]/.test(password) },
      { label: 'No common patterns (qwerty, 12345...)', valid: password.length > 0 && !containsCommonPattern(password) },
    ];
  }, [password, mode]);

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    return passwordRules.filter((r) => r.valid).length;
  }, [password, passwordRules]);

  // ========== HANDLERS ==========

  const handleLogin = async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();

    if (res.status === 429) {
      setRateLimitSeconds(data.retryAfterSeconds || 60);
      setError(`Too many requests. Try again in ${data.retryAfterSeconds || 60}s.`);
      return;
    }

    if (res.status === 403) {
      if (data.locked) {
        setMode('locked');
        setLockEmail('');
        setError(data.error);
        return;
      }
      if (data.requiresVerification) {
        setPendingEmail(data.email);
        setMode('verify-otp');
        setError('');
        setSuccess('Please enter the verification code sent to your email.');
        return;
      }
    }

    if (res.ok) {
      onSuccess(data.user);
    } else {
      setRemainingAttempts(data.remainingAttempts ?? null);
      setError(data.error || 'Login failed');
    }
  };

  const handleRegister = async () => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();

    if (res.status === 429) {
      setRateLimitSeconds(data.retryAfterSeconds || 60);
      setError(`Too many attempts. Try again in ${data.retryAfterSeconds || 60}s.`);
      return;
    }

    if (res.ok && data.requiresVerification) {
      setPendingEmail(email);
      setMode('verify-otp');
      setError('');
      setSuccess('Account created! Enter the verification code sent to your email.');
      return;
    }

    if (!res.ok) {
      setError(data.error || 'Registration failed');
    }
  };

  const handleVerifyOTP = async () => {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, code: otpCode }),
    });
    const data = await res.json();

    if (res.ok) {
      onSuccess(data.user);
    } else {
      setError(data.error || 'Invalid code');
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.status === 429) {
      setError('Too many resend attempts. Please wait.');
      return;
    }
    setSuccess(data.message || 'New code sent!');
    setError('');
    setOtpCode('');
  };

  const handleSendUnlockOTP = async () => {
    if (!lockEmail) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/auth/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: lockEmail }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMode('unlock-otp');
      setPendingEmail(lockEmail);
      setError('');
      setSuccess('Unlock code sent to your email.');
      setOtpCode('');
    } else {
      setError(data.error || 'Failed to send unlock code');
    }
  };

  const handleVerifyUnlock = async () => {
    const res = await fetch('/api/auth/unlock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, code: otpCode }),
    });
    const data = await res.json();

    if (res.ok) {
      setMode('login');
      setError('');
      setSuccess('Account unlocked! You can now log in.');
      setOtpCode('');
      setRemainingAttempts(null);
    } else {
      setError(data.error || 'Invalid unlock code');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      switch (mode) {
        case 'login': await handleLogin(); break;
        case 'register': await handleRegister(); break;
        case 'verify-otp': await handleVerifyOTP(); break;
        case 'unlock-otp': await handleVerifyUnlock(); break;
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  // ========== RENDER ==========

  return (
    <div className="auth-form-wrapper" id="auth-form">
      <div className="glass-card glass-card-accent auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-icon">
            {mode === 'login' ? '🔑' : mode === 'register' ? '✨' : mode === 'locked' ? '🔒' : '📧'}
          </div>
          <h2>
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && 'Create Account'}
            {mode === 'verify-otp' && 'Verify Email'}
            {mode === 'locked' && 'Account Locked'}
            {mode === 'unlock-otp' && 'Unlock Account'}
          </h2>
          <p>
            {mode === 'login' && 'Sign in to raise and solve queries'}
            {mode === 'register' && 'Join the IIT Ropar community'}
            {mode === 'verify-otp' && `Enter the 6-digit code sent to ${pendingEmail}`}
            {mode === 'locked' && 'Too many failed login attempts'}
            {mode === 'unlock-otp' && `Enter the unlock code sent to ${pendingEmail}`}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className={`error-alert ${rateLimitSeconds > 0 ? '' : 'shake-once'}`}>
              {error}
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <div className="remaining-attempts">
                  ⚠️ {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before account lock
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="success-alert">{success}</div>
          )}

          {/* ===== LOGIN MODE ===== */}
          {mode === 'login' && (
            <>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="auth-identifier">Username or Email</label>
                <input id="auth-identifier" className="input" type="text" placeholder="Enter username or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
              </div>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="auth-password">Password</label>
                <input id="auth-password" className="input" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} id="login-btn">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              {/* Google OAuth */}
              <div className="auth-divider">
                <span>or</span>
              </div>
              <button type="button" className="btn btn-google w-full" onClick={handleGoogleLogin} id="google-login-btn">
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </>
          )}

          {/* ===== REGISTER MODE ===== */}
          {mode === 'register' && (
            <>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="auth-username">Username</label>
                <input id="auth-username" className="input" type="text" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoComplete="username" required minLength={3} maxLength={30} />
              </div>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="auth-email">Email</label>
                <input id="auth-email" className="input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="auth-password">Password</label>
                <input id="auth-password" className="input" type="password" placeholder="Create a strong password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              {password.length > 0 && (
                <div className="password-feedback mb-md">
                  <div className="password-strength-bar">
                    <div className={`password-strength-fill strength-${passwordStrength}`} style={{ width: `${(passwordStrength / 4) * 100}%` }} />
                  </div>
                  <div className="password-rules">
                    {passwordRules.map((rule, i) => (
                      <div key={i} className={`password-rule ${rule.valid ? 'valid' : 'invalid'}`}>
                        <span className="rule-icon">{rule.valid ? '✅' : '❌'}</span>
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading} id="register-btn">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="auth-divider"><span>or</span></div>
              <button type="button" className="btn btn-google w-full" onClick={handleGoogleLogin} id="google-register-btn">
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </button>
            </>
          )}

          {/* ===== VERIFY OTP MODE ===== */}
          {mode === 'verify-otp' && (
            <>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="otp-input">Verification Code</label>
                <input id="otp-input" className="input otp-input" type="text" placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} autoComplete="one-time-code" required inputMode="numeric" />
              </div>
              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || otpCode.length !== 6} id="verify-otp-btn">
                {loading ? 'Verifying...' : '✅ Verify Email'}
              </button>
              <button type="button" className="btn btn-ghost w-full mt-md" onClick={handleResendOTP} disabled={loading} id="resend-otp-btn">
                📧 Resend Code
              </button>
            </>
          )}

          {/* ===== LOCKED MODE ===== */}
          {mode === 'locked' && (
            <>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="lock-email">Your Email</label>
                <input id="lock-email" className="input" type="email" placeholder="Enter your account email" value={lockEmail} onChange={(e) => setLockEmail(e.target.value)} required />
              </div>
              <button type="button" className="btn btn-primary w-full btn-lg" onClick={handleSendUnlockOTP} disabled={loading} id="send-unlock-btn">
                {loading ? 'Sending...' : '📧 Send Unlock Code'}
              </button>
            </>
          )}

          {/* ===== UNLOCK OTP MODE ===== */}
          {mode === 'unlock-otp' && (
            <>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="unlock-otp-input">Unlock Code</label>
                <input id="unlock-otp-input" className="input otp-input" type="text" placeholder="000000" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} autoComplete="one-time-code" required inputMode="numeric" />
              </div>
              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading || otpCode.length !== 6} id="verify-unlock-btn">
                {loading ? 'Unlocking...' : '🔓 Unlock Account'}
              </button>
            </>
          )}
        </form>

        {/* Mode Toggle */}
        <div className="auth-toggle">
          {(mode === 'login' || mode === 'locked') && (
            <p>
              Don&apos;t have an account?{' '}
              <button className="auth-toggle-btn" onClick={() => { setMode('register'); setError(''); setSuccess(''); }} id="switch-to-register">Sign Up</button>
            </p>
          )}
          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button className="auth-toggle-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} id="switch-to-login">Sign In</button>
            </p>
          )}
          {(mode === 'verify-otp' || mode === 'unlock-otp') && (
            <p>
              <button className="auth-toggle-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); setOtpCode(''); }} id="back-to-login">← Back to Login</button>
            </p>
          )}
          {mode === 'locked' && (
            <p>
              <button className="auth-toggle-btn" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} id="back-to-login-from-lock">← Back to Login</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function containsCommonPattern(password: string): boolean {
  const lc = password.toLowerCase();
  const patterns = [
    'password', 'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl',
    'zxcvbn', '123456', '12345678', '111111', '000000',
    'abc123', 'abcdef', 'letmein', 'welcome', 'admin',
    'passw0rd', 'qwerty123', '1q2w3e4r', 'qazwsx',
  ];
  return patterns.some((p) => lc.includes(p));
}
