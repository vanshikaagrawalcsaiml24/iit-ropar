'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AdminRole = 'super_admin' | 'admin';

export default function AdminLoginPage() {
  const [role, setRole] = useState<AdminRole>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || (role === 'admin' && !username)) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, username, password }),
      });

      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid credentials. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="admin-login glass-card glass-card-accent" id="admin-login-form">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, var(--accent-amber), #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-md)',
            fontSize: '1.5rem',
          }}>
            {role === 'super_admin' ? '👑' : '🔒'}
          </div>
          <h1>{role === 'super_admin' ? 'Super Admin Access' : 'Admin Login'}</h1>
          <p>
            {role === 'super_admin'
              ? 'Complete system access and analytics'
              : 'Manage FAQs and escalated queries'}
          </p>
        </div>

        <div className="auth-toggle" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="tab-switcher" style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              className={`btn btn-sm ${role === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => { setRole('admin'); setError(''); }}
              type="button"
            >
              Admin
            </button>
            <button
              className={`btn btn-sm ${role === 'super_admin' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => { setRole('super_admin'); setError(''); }}
              type="button"
            >
              Super Admin
            </button>
          </div>
        </div>

        <form onSubmit={handleLogin}>
          {error && <div className="error-alert">{error}</div>}

          {role === 'admin' && (
            <div className="input-group mb-md">
              <label className="input-label" htmlFor="admin-username">
                Username
              </label>
              <input
                id="admin-username"
                className="input"
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group mb-lg">
            <label className="input-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className="input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full btn-lg"
            disabled={loading || !password || (role === 'admin' && !username)}
            id="admin-login-btn"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
