'use client';

import { useState, useEffect, useCallback } from 'react';
import AuthGuard from '@/components/AuthGuard';

interface LoginEvent {
  timestamp: string;
  ip: string;
  userAgent: string;
  success: boolean;
}

export default function AccountPage() {
  return (
    <AuthGuard>
      {(user) => <AccountContent user={user} />}
    </AuthGuard>
  );
}

function AccountContent({ user }: { user: { userId: string; username: string } }) {
  const [loginHistory, setLoginHistory] = useState<LoginEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Deletion flow
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'code' | 'deleting' | 'deleted'>('idle');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/history');
      if (res.ok) {
        const data = await res.json();
        setLoginHistory(data.history || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRequestDeletion = async () => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setDeleteStep('code');
        setDeleteSuccess(data.message || 'Check your email for the confirmation code.');
      } else {
        setDeleteError(data.error || 'Failed to initiate deletion');
      }
    } catch {
      setDeleteError('Network error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!deleteCode || deleteCode.length < 8) {
      setDeleteError('Please enter the 8-character code from your email.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: deleteCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteStep('deleted');
        setDeleteSuccess('Account permanently deleted. Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else {
        setDeleteError(data.error || 'Deletion failed');
      }
    } catch {
      setDeleteError('Network error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1>Account Settings</h1>
        <p>Manage your account and view login activity</p>
      </div>

      {/* Account Info */}
      <div className="glass-card mb-lg" style={{ animation: 'slideUp 0.5s ease' }}>
        <div className="section-title">
          <span className="section-title-icon">👤</span>
          Profile
        </div>
        <div className="account-info-grid">
          <div className="account-info-item">
            <span className="account-info-label">Username</span>
            <span className="account-info-value">{user.username}</span>
          </div>
        </div>
      </div>

      {/* Login History */}
      <div className="glass-card mb-lg" style={{ animation: 'slideUp 0.5s ease 0.1s both' }}>
        <div className="section-title">
          <span className="section-title-icon">📋</span>
          Login History
        </div>
        {loadingHistory ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: 'var(--space-sm) 0' }}>
                <div className="skeleton skeleton-text" style={{ width: '80%' }} />
              </div>
            ))}
          </div>
        ) : loginHistory.length > 0 ? (
          <div className="login-history-list">
            {loginHistory.map((event, i) => (
              <div key={i} className={`login-history-item ${event.success ? 'success' : 'failed'}`}>
                <div className="login-history-status">
                  {event.success ? '✅' : '❌'}
                </div>
                <div className="login-history-details">
                  <div className="login-history-time">
                    {new Date(event.timestamp).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  <div className="login-history-meta">
                    IP: {event.ip} · {event.userAgent.split(' ').slice(0, 3).join(' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No login history available.</p>
        )}
      </div>

      {/* Danger Zone — Delete Account */}
      <div className="danger-zone-card" style={{ animation: 'slideUp 0.5s ease 0.2s both' }}>
        <div className="section-title" style={{ color: 'var(--accent-red-light)' }}>
          <span className="section-title-icon">⚠️</span>
          Danger Zone
        </div>

        {deleteStep === 'idle' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
              Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
            </p>
            <button className="btn btn-danger" onClick={() => setDeleteStep('confirm')} id="delete-account-start">
              🗑️ Delete My Account
            </button>
          </div>
        )}

        {deleteStep === 'confirm' && (
          <div>
            <p style={{ color: 'var(--accent-red-light)', fontSize: '0.9rem', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
              Are you sure? This will permanently delete your account, all your queries, and login history.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <button className="btn btn-danger" onClick={handleRequestDeletion} disabled={deleteLoading} id="delete-account-confirm">
                {deleteLoading ? 'Sending email...' : 'Yes, Send Confirmation Email'}
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleteStep('idle')} id="delete-account-cancel">
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteStep === 'code' && (
          <div>
            {deleteSuccess && <div className="success-alert mb-md">{deleteSuccess}</div>}
            {deleteError && <div className="error-alert mb-md">{deleteError}</div>}
            <div className="input-group mb-md">
              <label className="input-label" htmlFor="delete-code-input">Confirmation Code (from email)</label>
              <input
                id="delete-code-input"
                className="input"
                type="text"
                placeholder="Enter 8-character code"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value.toUpperCase().slice(0, 8))}
                maxLength={8}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <button className="btn btn-danger" onClick={handleConfirmDeletion} disabled={deleteLoading || deleteCode.length < 8} id="delete-account-final">
                {deleteLoading ? 'Deleting...' : '⚠️ Permanently Delete'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setDeleteStep('idle'); setDeleteCode(''); setDeleteError(''); }} id="delete-account-cancel-code">
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteStep === 'deleted' && (
          <div className="success-alert">
            {deleteSuccess}
          </div>
        )}
      </div>
    </div>
  );
}
