'use client';

import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';

interface SolveQuery {
  _id: string;
  ticketId: string;
  question: string;
  status: 'active' | 'in-review' | 'resolved';
  proposedAnswer?: string;
  approvals: string[];
  requiredApprovals: number;
}

export default function SolveQueryPage() {
  return (
    <AuthGuard>
      {(user) => <SolveQueryContent user={user} />}
    </AuthGuard>
  );
}

function SolveQueryContent({ user }: { user: { userId: string; username: string } }) {
  const [query, setQuery] = useState<SolveQuery | null>(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState(false);

  const fetchQuery = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setAnswer('');
    setResolved(false);

    try {
      const res = await fetch('/api/queries?status=active');
      const data = await res.json();

      if (data.query) {
        setQuery(data.query);
      } else {
        setQuery(null);
      }
    } catch {
      setError('Failed to fetch a query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuery();
  }, []);

  const handleSubmitAnswer = async () => {
    if (!query || !answer.trim()) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/queries/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: query._id,
          action: 'answer',
          answer: answer.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('✅ Answer submitted! Your approval counts as the first of three.');
        setTimeout(fetchQuery, 2000);
      } else {
        setError(data.error || 'Failed to submit answer');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!query) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/queries/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: query._id,
          action: 'approve',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.resolved) {
          setResolved(true);
          setMessage('🎉 Query resolved! The community has approved this answer.');
        } else {
          setMessage(`👍 Approval recorded! (${data.approvals}/3 approvals)`);
          setTimeout(fetchQuery, 2000);
        }
      } else {
        setError(data.error || 'Failed to approve');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!query || !confirm('Are you sure you want to escalate this to an admin?')) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/queries/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: query._id,
          action: 'escalate',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('🚨 Query escalated to system administrators.');
        setTimeout(fetchQuery, 2000);
      } else {
        setError(data.error || 'Failed to escalate');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1>Solve a Query</h1>
        <p>Help your peers by answering their questions. Three approvals to resolve!</p>
      </div>

      <div className="solve-container">
        {loading ? (
          <div className="glass-card">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '75%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        ) : resolved ? (
          <div className="glass-card glass-card-accent" style={{ animation: 'scaleIn 0.4s ease' }}>
            <div className="success-state">
              <div className="success-icon">🎉</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: 'var(--space-sm)' }}>
                Query Resolved!
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                Thanks for helping the community. The answer has been verified by peers.
              </p>
              <button className="btn btn-primary" onClick={fetchQuery} id="get-next-query-btn">
                💡 Get Another Query
              </button>
            </div>
          </div>
        ) : query ? (
          <div className="glass-card solve-query-card" id="solve-query-card">
            {/* Query Info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {query.ticketId}
              </span>
              <span className={`badge badge-${query.status === 'in-review' ? 'review' : query.status}`}>
                <span className="badge-dot" />
                {query.status === 'in-review' ? 'In Review' : 'Active'}
              </span>
            </div>

            <h2 className="solve-query-question">{query.question}</h2>

            {error && <div className="error-alert">{error}</div>}
            {message && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                color: 'var(--accent-green-light)',
                fontSize: '0.9rem',
                marginBottom: 'var(--space-md)',
              }}>
                {message}
              </div>
            )}

            {/* Active query — needs answer */}
            {query.status === 'active' && (
              <div>
                <div className="input-group mb-md">
                  <label className="input-label" htmlFor="answer-input">
                    Your Answer
                  </label>
                  <textarea
                    id="answer-input"
                    className="input textarea"
                    placeholder="Write your answer here..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={5}
                  />
                </div>
                <div className="solve-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitAnswer}
                    disabled={submitting || !answer.trim()}
                    style={{ flex: 1 }}
                    id="submit-answer-btn"
                  >
                    {submitting ? 'Submitting...' : '✅ Submit Answer'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={fetchQuery}
                    disabled={submitting}
                    id="skip-query-btn"
                  >
                    Skip →
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleEscalate}
                    disabled={submitting}
                    id="escalate-query-btn"
                    title="Escalate to admin"
                  >
                    🚨 Escalate
                  </button>
                </div>
              </div>
            )}

            {/* In-review query — approve or skip */}
            {query.status === 'in-review' && query.proposedAnswer && (
              <div>
                <div style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 'var(--space-md)',
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Proposed Answer
                  </div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {query.proposedAnswer}
                  </p>
                </div>

                {/* Approval Progress */}
                <div className="mb-md">
                  <div className="approval-bar">
                    <div
                      className="approval-bar-fill"
                      style={{ width: `${((query.approvals?.length || 0) / (query.requiredApprovals || 3)) * 100}%` }}
                    />
                  </div>
                  <div className="approval-text">
                    {query.approvals?.length || 0} / {query.requiredApprovals || 3} peer approvals
                  </div>
                </div>

                <div className="solve-actions">
                  <button
                    className="btn btn-success"
                    onClick={handleApprove}
                    disabled={submitting}
                    style={{ flex: 1 }}
                    id="approve-answer-btn"
                  >
                    {submitting ? 'Approving...' : '👍 Approve Answer'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={fetchQuery}
                    disabled={submitting}
                    id="skip-review-btn"
                  >
                    Skip →
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleEscalate}
                    disabled={submitting}
                    id="escalate-review-btn"
                    title="Escalate to admin"
                  >
                    🚨 Escalate
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card">
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <h3>All Caught Up!</h3>
              <p>There are no active queries to solve right now. Check back later!</p>
              <button className="btn btn-secondary mt-lg" onClick={fetchQuery} id="refresh-queries-btn">
                🔄 Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
