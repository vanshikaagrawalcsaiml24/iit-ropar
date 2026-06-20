'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AuthForm from './AuthForm';
interface AuthGuardProps {
  children: (user: { userId: string; username: string }) => React.ReactNode;
}
export default function AuthGuard({ children }: AuthGuardProps) {
  return (
    <Suspense fallback={
      <div className="content-wrapper">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="search-spinner" style={{ width: '32px', height: '32px' }} />
        </div>
      </div>
    }>
      <AuthGuardInner>{children}</AuthGuardInner>
    </Suspense>
  );
}
function AuthGuardInner({ children }: AuthGuardProps) {
  const [user, setUser] = useState<{ userId: string; username: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchParams = useSearchParams();
  const checkAuth = useCallback(async (isPolling = false) => {
    try {
      const res = await fetch('/api/auth/verify');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser((prev) => {
            // Only update state if the user object actually changed
            if (prev && prev.userId === data.user.userId && prev.username === data.user.username) {
              return prev;
            }
            return data.user;
          });
          setSessionExpired(false);
          return;
        }
      } setSessionExpired(false);
      setUser((prev) => {
        if (prev && isPolling) {
          setSessionExpired(true);
        }
        return null;
      });
    } catch {
      // Network error — don't logout
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth(false);
  }, [checkAuth]);

  // Handle Google OAuth return
  useEffect(() => {
    const authStatus = searchParams.get('auth');
    if (authStatus === 'success') {
      checkAuth(false);
    }
  }, [searchParams, checkAuth]);

  // Poll session every 5 minutes
  useEffect(() => {
    if (user) {
      intervalRef.current = setInterval(() => {
        checkAuth(true);
      }, 5 * 60 * 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, checkAuth]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    setUser(null);
    setSessionExpired(false);
  };

  const handleAuthSuccess = () => {
    checkAuth(false);
  };

  if (checking) {
    return (
      <div className="content-wrapper">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="search-spinner" style={{ width: '32px', height: '32px' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="content-wrapper">
        {sessionExpired && (
          <div className="session-expired-banner">
            <span>⏱️</span> Your session has expired. Please log in again.
          </div>
        )}
        <AuthForm onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div>
      <div className="auth-user-bar">
        <div className="auth-user-info">
          <div className="user-avatar">{user.username[0].toUpperCase()}</div>
          <span className="user-name">Logged in as <strong>{user.username}</strong></span>
        </div>
        <div className="auth-user-actions">
          <a href="/account" className="btn btn-ghost btn-sm" id="account-settings-btn">
            ⚙️ Account
          </a>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">
            Logout
          </button>
        </div>
      </div>
      {children(user)}
    </div>
  );
}
