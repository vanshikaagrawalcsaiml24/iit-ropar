'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AuthGuard from '@/components/AuthGuard';
import TicketDisplay from '@/components/TicketDisplay';
import StatusTracker from '@/components/StatusTracker';
import FAQCard from '@/components/FAQCard';

interface TrackedQuery {
  _id: string;
  ticketId: string;
  question: string;
  status: 'active' | 'in-review' | 'resolved';
  proposedAnswer?: string;
  approvals: string[];
  requiredApprovals: number;
  createdAt: string;
}

export default function RaiseQueryPage() {
  return (
    <AuthGuard>
      {(user) => <RaiseQueryContent user={user} />}
    </AuthGuard>
  );
}

function RaiseQueryContent({ user }: { user: { userId: string; username: string } }) {
  // Submit query state
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Semantic Search state
  const [similarFaqs, setSimilarFaqs] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Track query state
  const [trackTicketId, setTrackTicketId] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackedQuery, setTrackedQuery] = useState<TrackedQuery | null>(null);
  const [trackError, setTrackError] = useState('');

  // User's own queries (auto-populated)
  const [myQueries, setMyQueries] = useState<TrackedQuery[]>([]);
  const [loadingMyQueries, setLoadingMyQueries] = useState(true);

  // Fetch user's queries on mount
  const fetchMyQueries = useCallback(async () => {
    setLoadingMyQueries(true);
    try {
      const res = await fetch(`/api/queries?userId=${encodeURIComponent(user.userId)}`);
      const data = await res.json();
      if (res.ok) {
        setMyQueries(data.queries || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMyQueries(false);
    }
  }, [user.userId]);

  useEffect(() => {
    fetchMyQueries();
  }, [fetchMyQueries]);

  // Real-time semantic search
  useEffect(() => {
    if (!question.trim()) {
      setSimilarFaqs([]);
      setIsSearching(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/faqs?q=${encodeURIComponent(question.trim())}`);
        const data = await res.json();

        if (data.faqs) {
          // Take top 3
          setSimilarFaqs(data.faqs.slice(0, 3));
        } else {
          setSimilarFaqs([]);
        }
      } catch (err) {
        setSimilarFaqs([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [question]);

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setSubmitting(true);
    setSubmitError('');
    setSubmittedTicketId(null);

    try {
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmittedTicketId(data.ticketId);
        setQuestion('');
        fetchMyQueries(); // Refresh user's queries
      } else {
        setSubmitError(data.error || 'Failed to submit query');
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTicketId.trim()) return;

    setTracking(true);
    setTrackError('');
    setTrackedQuery(null);

    try {
      const res = await fetch(`/api/queries?ticketId=${encodeURIComponent(trackTicketId.trim())}`);
      const data = await res.json();

      if (res.ok) {
        setTrackedQuery(data.query);
      } else {
        setTrackError(data.error || 'Query not found');
      }
    } catch {
      setTrackError('Network error. Please try again.');
    } finally {
      setTracking(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1>Raise a Query</h1>
        <p>Ask your question and get help from the IIT Ropar community</p>
      </div>

      <div className="query-sections">
        {/* Submit Query Section */}
        <div className="glass-card" style={{ animation: 'slideUp 0.5s ease' }} id="submit-query-section">
          <div className="section-title">
            <span className="section-title-icon">✍️</span>
            Submit a Query
          </div>

          {submittedTicketId ? (
            <div>
              <TicketDisplay ticketId={submittedTicketId} />
              <button
                className="btn btn-secondary w-full mt-lg"
                onClick={() => {
                  setSubmittedTicketId(null);
                }}
                id="submit-another-btn"
              >
                Submit Another Query
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitQuery}>
              {submitError && (
                <div className="error-alert">{submitError}</div>
              )}
              <div className="input-group mb-lg">
                <label className="input-label" htmlFor="query-input">
                  Your Question
                </label>
                <textarea
                  id="query-input"
                  className="input textarea"
                  placeholder="Describe your question in detail..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={5}
                  required
                />
              </div>

              {/* Real-time Semantic Search Results */}
              {isSearching ? (
                <div style={{ marginBottom: 'var(--space-md)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span className="search-spinner" style={{ width: '12px', height: '12px', display: 'inline-block', marginRight: '8px' }} />
                  Checking for similar answers...
                </div>
              ) : similarFaqs.length > 0 ? (
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 'var(--space-sm)' }}>
                    💡 Similar answers found:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {similarFaqs.map((faq, idx) => (
                      <FAQCard
                        key={`similar-${idx}`}
                        question={faq.question}
                        answer={faq.answer}
                        category={faq.category}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                    Still need help? You can submit your query below.
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={submitting || !question.trim()}
                id="submit-query-btn"
              >
                {submitting ? 'Submitting...' : '🚀 Submit Query'}
              </button>
            </form>
          )}
        </div>

        {/* Track Query Section */}
        <div className="glass-card" style={{ animation: 'slideUp 0.5s ease 0.1s both' }} id="track-query-section">
          <div className="section-title">
            <span className="section-title-icon">🔎</span>
            Track Your Query
          </div>

          <form onSubmit={handleTrackQuery} className="mb-lg">
            {trackError && (
              <div className="error-alert">{trackError}</div>
            )}
            <div className="input-group mb-md">
              <label className="input-label" htmlFor="track-input">
                Ticket ID
              </label>
              <input
                id="track-input"
                className="input"
                type="text"
                placeholder="e.g. abc45-df43-88io-123a"
                value={trackTicketId}
                onChange={(e) => setTrackTicketId(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary w-full"
              disabled={tracking || !trackTicketId.trim()}
              id="track-query-btn"
            >
              {tracking ? 'Tracking...' : '📍 Track Query'}
            </button>
          </form>

          {trackedQuery && (
            <div style={{ animation: 'slideUp 0.4s ease' }}>
              <QueryStatusCard query={trackedQuery} />
            </div>
          )}
        </div>
      </div>

      {/* User's Queries Section */}
      <div className="glass-card mt-2xl" style={{ animation: 'slideUp 0.5s ease 0.2s both' }} id="my-queries-section">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span className="section-title-icon">📋</span>
            My Queries
          </div>
          <span className="badge badge-review">{myQueries.length} total</span>
        </div>

        {loadingMyQueries ? (
          <div>
            {[1, 2].map((i) => (
              <div key={i} style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>
        ) : myQueries.length > 0 ? (
          <div className="my-queries-list">
            {myQueries.map((q) => (
              <div
                key={q._id}
                className="my-query-item"
                onClick={() => {
                  setTrackTicketId(q.ticketId);
                  setTrackedQuery(q);
                }}
              >
                <div className="my-query-top">
                  <span className="my-query-ticket">{q.ticketId}</span>
                  <span className={`badge badge-${q.status === 'in-review' ? 'review' : q.status}`}>
                    <span className="badge-dot" />
                    {q.status === 'in-review' ? 'In Review' : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                  </span>
                </div>
                <div className="my-query-question">{q.question}</div>
                <div className="my-query-date">
                  {new Date(q.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No queries yet</h3>
            <p>Your submitted queries will appear here automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function QueryStatusCard({ query }: { query: TrackedQuery }) {
  return (
    <div>
      <div style={{
        padding: 'var(--space-md)',
        background: 'var(--bg-glass)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        marginBottom: 'var(--space-lg)'
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Ticket: {query.ticketId}
        </div>
        <div style={{ fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
          {query.question}
        </div>
        <span className={`badge badge-${query.status === 'in-review' ? 'review' : query.status}`}>
          <span className="badge-dot" />
          {query.status === 'in-review' ? 'In Review' : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <StatusTracker
          status={query.status}
          approvals={query.approvals?.length || 0}
          requiredApprovals={query.requiredApprovals || 3}
        />
      </div>

      {query.status === 'in-review' && (
        <div className="mt-lg">
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
      )}

      {query.status === 'resolved' && query.proposedAnswer && (
        <div className="mt-lg" style={{
          padding: 'var(--space-md)',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-green-light)', fontWeight: 600, marginBottom: '4px' }}>
            ✅ Resolved Answer
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {query.proposedAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
