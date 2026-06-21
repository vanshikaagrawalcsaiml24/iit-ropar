'use client';

import { useState, useEffect, useCallback } from 'react';
import AuthGuard from '@/components/AuthGuard';
import TicketDisplay from '@/components/TicketDisplay';
import StatusTracker from '@/components/StatusTracker';
import FAQCard from '@/components/FAQCard';

interface TrackedQuery {
  _id: string;
  ticketId: string;
  title?: string;
  question: string;
  status: 'active' | 'in-review' | 'resolved' | 'escalated';
  proposedAnswer?: string;
  approvals: string[];
  requiredApprovals: number;
  createdAt: string;
}

type FlowStep = 'write' | 'results' | 'generate-title' | 'submitted';

export default function RaiseQueryPage() {
  return (
    <AuthGuard>
      {(user) => <RaiseQueryContent user={user} />}
    </AuthGuard>
  );
}

function RaiseQueryContent({ user }: { user: { userId: string; username: string } }) {
  // Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('write');

  // Write query state
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Search state
  const [similarFaqs, setSimilarFaqs] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Title generation state
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

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

  // Search FAQs (triggered on button click, not real-time)
  const handleSearchFaqs = async () => {
    if (!question.trim()) return;

    setIsSearching(true);
    setSimilarFaqs([]);

    try {
      const res = await fetch(`/api/faqs?q=${encodeURIComponent(question.trim())}`);
      const data = await res.json();

      if (data.faqs) {
        setSimilarFaqs(data.faqs.slice(0, 5));
      } else {
        setSimilarFaqs([]);
      }
    } catch {
      setSimilarFaqs([]);
    } finally {
      setIsSearching(false);
      setFlowStep('results');
    }
  };

  // Generate title via NLP API
  const handleAskNewQuery = async () => {
    setFlowStep('generate-title');
    setIsGeneratingTitle(true);

    try {
      const res = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question.trim() }),
      });
      const data = await res.json();
      if (data.title) {
        setGeneratedTitle(data.title);
      } else {
        setGeneratedTitle(question.trim().substring(0, 60));
      }
    } catch {
      setGeneratedTitle(question.trim().substring(0, 60));
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  // Submit the query
  const handleSubmitQuery = async () => {
    if (!question.trim()) return;

    setSubmitting(true);
    setSubmitError('');
    setSubmittedTicketId(null);

    try {
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          title: generatedTitle || question.trim().substring(0, 60),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmittedTicketId(data.ticketId);
        setFlowStep('submitted');
        fetchMyQueries();
      } else {
        setSubmitError(data.error || 'Failed to submit query');
      }
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Track query
  const handleTrackQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  // Reset flow
  const handleReset = () => {
    setFlowStep('write');
    setQuestion('');
    setSimilarFaqs([]);
    setGeneratedTitle('');
    setSubmittedTicketId(null);
    setSubmitError('');
  };

  return (
    <div className="content-wrapper">
      <div className="page-header">
        <h1>Raise a Query</h1>
        <p>Ask your question and get help from the IIT Ropar community</p>
      </div>

      <div className="rq-layout">
        {/* ===== LEFT COLUMN: Main Form ===== */}
        <div className="rq-main">

          {/* Step 1: Write Query */}
          <div className="glass-card" style={{ animation: 'slideUp 0.5s ease' }} id="write-query-section">
            <div className="section-title">
              <span className="section-title-icon">✍️</span>
              Write Your Query
            </div>

            {flowStep === 'submitted' && submittedTicketId ? (
              <div>
                <TicketDisplay ticketId={submittedTicketId} />
                <div className="rq-success-info">
                  <div className="rq-success-badge">
                    <span>✅</span> Your query is now live for peers to solve
                  </div>
                  {generatedTitle && (
                    <div className="rq-generated-title-display">
                      <span className="rq-title-label">Generated Title</span>
                      <span className="rq-title-text">{generatedTitle}</span>
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-secondary w-full mt-lg"
                  onClick={handleReset}
                  id="submit-another-btn"
                >
                  Submit Another Query
                </button>
              </div>
            ) : (
              <div>
                {submitError && (
                  <div className="error-alert">{submitError}</div>
                )}

                <div className="input-group mb-lg">
                  <label className="input-label" htmlFor="query-input">
                    Describe your question in detail
                  </label>
                  <textarea
                    id="query-input"
                    className="input textarea"
                    placeholder="Type your question here... Be as detailed as possible so we can find the best answer or route it to the right peers."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={5}
                    disabled={flowStep === 'generate-title'}
                  />
                </div>

                {/* Step 1 action: Search FAQs */}
                {flowStep === 'write' && (
                  <button
                    className="btn btn-primary w-full"
                    onClick={handleSearchFaqs}
                    disabled={isSearching || !question.trim()}
                    id="search-faqs-btn"
                  >
                    {isSearching ? (
                      <>
                        <span className="rq-btn-spinner" />
                        Searching FAQs...
                      </>
                    ) : (
                      '🔍 Search Existing FAQs'
                    )}
                  </button>
                )}

                {/* Step 2: Show Results */}
                {flowStep === 'results' && (
                  <div className="rq-results-section" style={{ animation: 'slideUp 0.4s ease' }}>
                    {similarFaqs.length > 0 ? (
                      <>
                        <div className="rq-results-header">
                          <span className="rq-results-icon">💡</span>
                          <span>We found {similarFaqs.length} similar FAQ{similarFaqs.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="rq-results-list">
                          {similarFaqs.map((faq, idx) => (
                            <SimilarFAQItem key={`similar-${idx}`} faq={faq} rank={idx + 1} />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rq-no-results">
                        <span className="rq-no-results-icon">📭</span>
                        <span>No similar FAQs found in our database.</span>
                      </div>
                    )}

                    <div className="rq-didnt-find">
                      <div className="rq-didnt-find-text">
                        {similarFaqs.length > 0
                          ? "Didn't find what you were looking for?"
                          : "Let's get your question answered by peers!"}
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleAskNewQuery}
                        id="ask-new-query-btn"
                      >
                        🚀 Ask New Query
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setFlowStep('write')}
                      >
                        ← Edit Query
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Generated Title + Confirm */}
                {flowStep === 'generate-title' && (
                  <div className="rq-title-section" style={{ animation: 'slideUp 0.4s ease' }}>
                    <div className="rq-title-header">
                      <span className="rq-title-header-icon">🤖</span>
                      AI-Generated Title
                    </div>

                    {isGeneratingTitle ? (
                      <div className="rq-title-generating">
                        <span className="rq-btn-spinner" />
                        Generating a concise title...
                      </div>
                    ) : (
                      <>
                        <div className="input-group mb-lg">
                          <label className="input-label" htmlFor="title-input">
                            Review & edit the title
                          </label>
                          <input
                            id="title-input"
                            className="input"
                            type="text"
                            value={generatedTitle}
                            onChange={(e) => setGeneratedTitle(e.target.value)}
                            placeholder="Query title..."
                          />
                          <div className="rq-title-hint">
                            This title will be shown to peers who can solve your query.
                          </div>
                        </div>

                        <button
                          className="btn btn-primary w-full"
                          onClick={handleSubmitQuery}
                          disabled={submitting || !generatedTitle.trim()}
                          id="confirm-submit-btn"
                        >
                          {submitting ? (
                            <>
                              <span className="rq-btn-spinner" />
                              Submitting...
                            </>
                          ) : (
                            '✅ Confirm & Submit Query'
                          )}
                        </button>
                        <button
                          className="btn btn-ghost w-full mt-md"
                          onClick={() => setFlowStep('results')}
                        >
                          ← Back to Results
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User's Queries Section */}
          <div className="glass-card mt-lg" style={{ animation: 'slideUp 0.5s ease 0.2s both' }} id="my-queries-section">
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
                    <div className="my-query-question">{q.title || q.question}</div>
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

        {/* ===== RIGHT COLUMN: Tracking Sidebar ===== */}
        <div className="rq-sidebar">
          {/* Track Query */}
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
          )}
        </div>

            {trackedQuery && (
              <div style={{ animation: 'slideUp 0.4s ease' }}>
                <QueryStatusCard query={trackedQuery} onEscalated={() => { handleTrackQuery(); fetchMyQueries(); }} />
              </div>
            )}
          </div>

            {trackedQuery && (
              <div style={{ animation: 'slideUp 0.4s ease' }}>
                <QueryStatusCard query={trackedQuery} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Similar FAQ Item with match %, reviews, verified ===== */
function SimilarFAQItem({ faq, rank }: { faq: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  // Simulate a match score from the vector search score field (Qdrant returns a score 0-1)
  const matchScore = faq.score
    ? Math.round(faq.score * 100)
    : Math.max(95 - rank * 12, 40);

  // Review count (from the FAQ data or default)
  const reviewCount = faq.reviewCount || faq.upvotes || 0;


/* ===== Similar FAQ Item with match %, reviews, verified ===== */
function SimilarFAQItem({ faq, rank }: { faq: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  // Simulate a match score from the vector search score field (Qdrant returns a score 0-1)
  const matchScore = faq.score
    ? Math.round(faq.score * 100)
    : Math.max(95 - rank * 12, 40);

  // Review count (from the FAQ data or default)
  const reviewCount = faq.reviewCount || faq.upvotes || 0;

  // Verified status
  const isVerified = faq.verified !== undefined ? faq.verified : true;

  return (
    <div
      className={`rq-faq-item ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
    >
      <div className="rq-faq-top">
        <div className="rq-faq-question">
          <h3>{faq.question}</h3>
        </div>
        <div className="rq-faq-toggle">{expanded ? '▲' : '▼'}</div>
      </div>

      <div className="rq-faq-meta">
        <span className={`rq-match-badge ${matchScore >= 80 ? 'high' : matchScore >= 50 ? 'medium' : 'low'}`}>
          {matchScore}% match
        </span>
        <span className="rq-review-count">
          👁️ {reviewCount} review{reviewCount !== 1 ? 's' : ''}
        </span>
        {isVerified && (
          <span className="rq-verified-badge">
            ✅ Verified
          </span>
        )}
        {faq.category && (
          <span className="badge badge-review rq-faq-category">
            {faq.category}
          </span>
        )}
      </div>

      {expanded && (
        <div className="rq-faq-answer" style={{ animation: 'slideDown 0.25s ease' }}>
          <p>{faq.answer}</p>
        </div>
      )}
    </div>
  );
}


/* ===== Query Status Card (right sidebar) ===== */
function QueryStatusCard({ query, onEscalated }: { query: TrackedQuery; onEscalated?: () => void }) {
  const [escalating, setEscalating] = useState(false);
  const [escalateError, setEscalateError] = useState('');

  const handleEscalate = async () => {
    if (!confirm('Are you sure you want to escalate this query to an admin?')) return;
    setEscalating(true);
    setEscalateError('');
    try {
      const res = await fetch('/api/queries/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: query.ticketId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (onEscalated) onEscalated();
      } else {
        setEscalateError(data.error || 'Failed to escalate');
      }
    } catch {
      setEscalateError('Network error. Please try again.');
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div className="rq-status-card">
      {/* Ticket ID */}
      <div className="rq-ticket-block">
        <div className="rq-ticket-label">Ticket ID</div>
        <div className="rq-ticket-id-value">{query.ticketId}</div>
      </div>

  return (
    <div className="rq-status-card">
      {/* Ticket ID */}
      <div className="rq-ticket-block">
        <div className="rq-ticket-label">Ticket ID</div>
        <div className="rq-ticket-id-value">{query.ticketId}</div>
      </div>

      {/* Query Info */}
      <div className="rq-status-info">
        <div className="rq-status-question">{query.title || query.question}</div>
        <span className={`badge badge-${query.status === 'in-review' ? 'review' : query.status}`}>
          <span className="badge-dot" />
          {query.status === 'in-review' ? 'In Review' : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
        </span>
      </div>

      {/* Status Timeline */}
      <div className="rq-timeline-section">
        <div className="rq-timeline-label">Query Status Timeline</div>
        <div style={{ position: 'relative' }}>
          <StatusTracker
            status={query.status === 'escalated' ? 'resolved' : query.status}
            approvals={query.approvals?.length || 0}
            requiredApprovals={query.requiredApprovals || 3}
          />
        </div>
      </div>

      {/* Peer Review Progress */}
      {(query.status === 'in-review' || query.status === 'active') && (
        <div className="rq-review-section">
          <div className="rq-review-header">
            <span>Peer Review Progress</span>
            <span className="rq-review-count-label">
              {query.approvals?.length || 0}/{query.requiredApprovals || 3}
            </span>
          </div>
          <div className="approval-bar">
            <div
              className="approval-bar-fill"
              style={{ width: `${((query.approvals?.length || 0) / (query.requiredApprovals || 3)) * 100}%` }}
            />
          </div>
          <div className="approval-text">
            {query.approvals?.length || 0} of {query.requiredApprovals || 3} peer approvals received
          </div>
        </div>
      )}

      {/* Resolved/Escalated Answer */}
      {(query.status === 'resolved' || query.status === 'escalated') && query.proposedAnswer && (
        <div className="rq-resolved-answer">
          <div className="rq-resolved-label">
            {query.status === 'escalated' ? '📝 Proposed Answer (Escalated)' : '✅ Resolved Answer'}
          </div>
          <div className="rq-resolved-text">{query.proposedAnswer}</div>
          
          {query.status === 'resolved' && (query.approvals?.length || 0) >= (query.requiredApprovals || 3) && (
            <div className="rq-escalate-section" style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border-light)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                Not satisfied with this answer?
              </p>
              {escalateError && <div className="error-alert" style={{ marginBottom: 'var(--space-sm)' }}>{escalateError}</div>}
              <button 
                className="btn btn-secondary w-full" 
                onClick={handleEscalate}
                disabled={escalating}
              >
                {escalating ? 'Escalating...' : '🚨 Escalate to Admin'}
              </button>
            </div>
          )}
        </div>
      )}

      {query.status === 'escalated' && (
         <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontWeight: 500, color: '#ef4444', marginBottom: 'var(--space-xs)' }}>🚨 Escalated to Admin</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              This query has been escalated. An admin will review and resolve it shortly.
            </div>
         </div>
      )}
    </div>
  );
}
