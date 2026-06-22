'use client';

import { useState, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';

interface SolveQuery {
  _id: string;
  ticketId: string;
  question: string;
  status: 'active' | 'in-review' | 'resolved' | 'escalated';
  proposedAnswer?: string;
  approvals: string[];
  requiredApprovals: number;
  upvotes?: number;
  upvotedBy?: string[];
  createdAt?: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SolveQueryPage() {
  return (
    <AuthGuard>
      {(user) => <SolveQueryContent user={user} />}
    </AuthGuard>
  );
}

function SolveQueryContent({ user }: { user: { userId: string; username: string } }) {
  const [queries, setQueries] = useState<SolveQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  const fetchQueries = async (currentSkipped: string[]) => {
    setLoading(true);
    setError('');
    try {
      const excludeParam = currentSkipped.join(',');
      const res = await fetch(`/api/queries?status=active&exclude=${excludeParam}`);
      const data = await res.json();

      if (data.queries) {
        setQueries(data.queries);
      } else {
        setQueries([]);
      }
    } catch {
      setError('Failed to fetch queries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries(skippedIds);
  }, []);

const handleSkip = (queryId: string) => {
  setSkippedIds((prev) => {
    const next = prev.includes(queryId) ? prev : [...prev, queryId];
    fetchQueries(next);
    return next;
  });
};

const handleActionSuccess = (queryId: string) => {
  // Treat solved/approved queries as excluded to fetch new replacements
  setSkippedIds((prev) => {
    const next = prev.includes(queryId) ? prev : [...prev, queryId];
    fetchQueries(next);
    return next;
  });
};

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1>Solve a Query</h1>
        <p>Help your peers by answering their questions. Three approvals to resolve!</p>
      </div>

      <div className="solve-container">
        {loading && queries.length === 0 ? (
          <div className="glass-card">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '75%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        ) : error ? (
          <div className="error-alert">{error}</div>
        ) : queries.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {queries.map((q) => (
              <QueryCardItem
                key={q._id}
                query={q}
                user={user}
                onSkip={() => handleSkip(q._id)}
                onActionSuccess={() => handleActionSuccess(q._id)}
              />
            ))}
          </div>
        ) : (
          <div className="glass-card">
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <h3>All Caught Up!</h3>
              <p>There are no active queries to solve right now. Check back later!</p>
              <button className="btn btn-secondary mt-lg" onClick={() => fetchQueries(skippedIds)} id="refresh-queries-btn">
                🔄 Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QueryCardItem({
  query,
  user,
  onSkip,
  onActionSuccess,
}: {
  query: SolveQuery;
  user: { userId: string; username: string };
  onSkip: () => void;
  onActionSuccess: () => void;
}) {
  const [queryData, setQueryData] = useState<SolveQuery>(query);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resolved, setResolved] = useState(false);
  const [upvoting, setUpvoting] = useState(false);
  const [upvoteAnimating, setUpvoteAnimating] = useState(false);

  // Keep queryData in sync if prop changes
  useEffect(() => {
    setQueryData(query);
    setResolved(query.status === 'resolved');
    setAnswer('');
    setMessage('');
    setError('');
  }, [query]);

  const handleUpvote = async () => {
    if (upvoting) return;

    setUpvoting(true);
    setUpvoteAnimating(true);
    setTimeout(() => setUpvoteAnimating(false), 400);

    try {
      const res = await fetch('/api/queries/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId: queryData._id }),
      });

      const data = await res.json();

      if (res.ok) {
        setQueryData((prev) => {
          const newUpvotedBy = data.hasUpvoted
            ? [...(prev.upvotedBy || []), user.userId]
            : (prev.upvotedBy || []).filter((id: string) => id !== user.userId);
          return {
            ...prev,
            upvotes: data.upvotes,
            upvotedBy: newUpvotedBy,
          };
        });
      } else {
        setError(data.error || 'Failed to upvote');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUpvoting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/queries/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: queryData._id,
          action: 'answer',
          answer: answer.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('✅ Answer submitted! Your approval counts as the first of three.');
        setTimeout(() => {
          onActionSuccess();
        }, 2000);
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
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/queries/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId: queryData._id,
          action: 'approve',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.resolved) {
          setResolved(true);
          setMessage('🎉 Query resolved! The community has approved this answer.');
          setTimeout(() => {
            onActionSuccess();
          }, 2000);
        } else {
          setMessage(`👍 Approval recorded! (${data.approvals}/3 approvals)`);
          setTimeout(() => {
            onActionSuccess();
          }, 2000);
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

  const hasUpvoted = queryData.upvotedBy?.includes(user.userId) || false;
  const upvoteCount = queryData.upvotes || 0;

  if (resolved) {
    return (
      <div className="glass-card glass-card-accent" style={{ animation: 'scaleIn 0.4s ease' }}>
        <div className="success-state">
          <div className="success-icon">🎉</div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: 'var(--space-sm)' }}>
            Query Resolved!
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
            Thanks for helping the community. The answer has been verified by peers.
          </p>
        </div>
      </div>
    );
  }

  // Determine status display text
  let displayStatus = 'Active';
  if (queryData.status === 'in-review') {
    displayStatus = 'In Review';
  } else if (queryData.status === 'escalated') {
    displayStatus = 'Escalated';
  }

  return (
    <div className="glass-card solve-query-card" id={`solve-query-card-${queryData._id}`} style={{ position: 'relative' }}>
      {/* Query Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {queryData.ticketId}
          </span>
          {queryData.createdAt && (
            <span className="query-timestamp">
              📅 {formatDate(queryData.createdAt)}
            </span>
          )}
        </div>
        <span className={`badge badge-${queryData.status === 'in-review' ? 'review' : queryData.status === 'escalated' ? 'escalated' : 'active'}`}>
          <span className="badge-dot" />
          {displayStatus}
        </span>
      </div>

      <h2 className="solve-query-question">{queryData.question}</h2>

      {/* Upvote Button */}
      <div className="upvote-section">
        <button
          className={`upvote-btn ${hasUpvoted ? 'active' : ''} ${upvoteAnimating ? 'animating' : ''}`}
          onClick={handleUpvote}
          disabled={upvoting}
          id={`upvote-query-btn-${queryData._id}`}
          title={hasUpvoted ? 'Remove upvote' : 'Upvote this query'}
        >
          <svg
            className="upvote-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill={hasUpvoted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          <span className="upvote-count">{upvoteCount}</span>
        </button>
        <span className="upvote-label">
          {upvoteCount === 1 ? '1 upvote' : `${upvoteCount} upvotes`}
        </span>
      </div>

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

      {/* Active or Escalated query — needs answer */}
      {(queryData.status === 'active' || queryData.status === 'escalated') && (
        <div>
          <div className="input-group mb-md">
            <label className="input-label" htmlFor={`answer-input-${queryData._id}`}>
              Your Answer
            </label>
            <textarea
              id={`answer-input-${queryData._id}`}
              className="input textarea"
              placeholder="Write your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              disabled={submitting}
            />
          </div>
          <div className="solve-actions">
            <button
              className="btn btn-primary"
              onClick={handleSubmitAnswer}
              disabled={submitting || !answer.trim()}
              style={{ flex: 1 }}
              id={`submit-answer-btn-${queryData._id}`}
            >
              {submitting ? 'Submitting...' : '✅ Submit Answer'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={onSkip}
              disabled={submitting}
              id={`skip-query-btn-${queryData._id}`}
            >
              Skip →
            </button>
          </div>
        </div>
      )}

      {/* In-review query — approve or skip */}
      {queryData.status === 'in-review' && queryData.proposedAnswer && (
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
              {queryData.proposedAnswer}
            </p>
          </div>

          {/* Approval Progress */}
          <div className="mb-md">
            <div className="approval-bar">
              <div
                className="approval-bar-fill"
                style={{ width: `${((queryData.approvals?.length || 0) / (queryData.requiredApprovals || 3)) * 100}%` }}
              />
            </div>
            <div className="approval-text">
              {queryData.approvals?.length || 0} / {queryData.requiredApprovals || 3} peer approvals
            </div>
          </div>

          <div className="solve-actions">
            <button
              className="btn btn-success"
              onClick={handleApprove}
              disabled={submitting}
              style={{ flex: 1 }}
              id={`approve-answer-btn-${queryData._id}`}
            >
              {submitting ? 'Approving...' : '👍 Approve Answer'}
            </button>
            <button
              className="btn btn-ghost"
              onClick={onSkip}
              disabled={submitting}
              id={`skip-review-btn-${queryData._id}`}
            >
              Skip →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
