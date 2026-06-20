'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  createdAt: string;
}

interface AdminUser {
  _id: string;
  username: string;
  active: boolean;
}

interface EscalatedQuery {
  _id: string;
  ticketId: string;
  question: string;
  status: string;
  createdAt: string;
}

type TabMode = 'faqs' | 'escalated' | 'analytics' | 'admins';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<'super_admin' | 'admin' | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabMode>('escalated');

  // FAQ state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  const [addError, setAddError] = useState('');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Escalated state
  const [escalated, setEscalated] = useState<EscalatedQuery[]>([]);
  const [loadingEscalated, setLoadingEscalated] = useState(true);
  const [answerTarget, setAnswerTarget] = useState<EscalatedQuery | null>(null);
  const [escalatedAnswer, setEscalatedAnswer] = useState('');
  const [answering, setAnswering] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Admins state
  const [adminsList, setAdminsList] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Check auth
  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('/api/admin/verify');
        if (res.ok) {
          const data = await res.json();
          setAuthenticated(true);
          setRole(data.role);
          if (data.role === 'admin') {
            setActiveTab('escalated');
          } else {
            setActiveTab('analytics');
          }
        } else {
          router.push('/admin');
        }
      } catch {
        router.push('/admin');
      } finally {
        setChecking(false);
      }
    };
    verify();
  }, [router]);

  const fetchFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    try {
      const res = await fetch('/api/faqs');
      const data = await res.json();
      setFaqs(data.faqs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  const fetchEscalated = useCallback(async () => {
    setLoadingEscalated(true);
    try {
      const res = await fetch('/api/admin/escalated');
      const data = await res.json();
      setEscalated(data.queries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEscalated(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (role !== 'super_admin') return;
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [role]);

  const fetchAdmins = useCallback(async () => {
    if (role !== 'super_admin') return;
    setLoadingAdmins(true);
    try {
      const res = await fetch('/api/admin/manage-admins');
      const data = await res.json();
      setAdminsList(data.admins || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdmins(false);
    }
  }, [role]);

  useEffect(() => {
    if (authenticated) {
      if (activeTab === 'faqs') fetchFaqs();
      if (activeTab === 'escalated') fetchEscalated();
      if (activeTab === 'analytics') fetchAnalytics();
      if (activeTab === 'admins') fetchAdmins();
    }
  }, [authenticated, activeTab, fetchFaqs, fetchEscalated, fetchAnalytics, fetchAdmins]);

  // Actions
  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setAdding(true); setAddError(''); setAddMessage('');
    try {
      const res = await fetch('/api/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim(), category: category.trim() }),
      });
      if (res.ok) {
        setAddMessage('✅ FAQ added and synchronized with Qdrant successfully!');
        setQuestion(''); setAnswer(''); setCategory('');
        fetchFaqs();
        setTimeout(() => setAddMessage(''), 3000);
      } else {
        const data = await res.json();
        setAddError(data.error || 'Failed to add FAQ');
      }
    } catch {
      setAddError('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/faqs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget._id }),
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchFaqs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleResolveEscalated = async () => {
    if (!answerTarget || !escalatedAnswer.trim()) return;
    setAnswering(true);
    try {
      const res = await fetch('/api/admin/escalated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId: answerTarget._id, answer: escalatedAnswer }),
      });
      if (res.ok) {
        setAnswerTarget(null);
        setEscalatedAnswer('');
        fetchEscalated();
      } else {
        alert('Failed to resolve query');
      }
    } catch {
      alert('Network error');
    } finally {
      setAnswering(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUser.trim() || !newAdminPass.trim()) return;
    setCreatingAdmin(true);
    try {
      const res = await fetch('/api/admin/manage-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newAdminUser, password: newAdminPass }),
      });
      if (res.ok) {
        setNewAdminUser(''); setNewAdminPass('');
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create admin');
      }
    } catch {
      alert('Network error');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm('Are you sure you want to delete this admin account?')) return;
    try {
      const res = await fetch('/api/admin/manage-admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchAdmins();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      const cookieStore = document.cookie.split(';');
      for (const c of cookieStore) {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      }
      window.location.href = '/admin';
    } catch { }
  };

  if (checking) {
    return (
      <div className="content-wrapper">
        <div className="flex justify-center items-center" style={{ minHeight: '50vh' }}>
          <div className="search-spinner" style={{ width: '32px', height: '32px' }} />
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="content-wrapper">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {role === 'super_admin' ? '👑 Super Admin' : '🔒 Admin'} Dashboard
          </h1>
          <p>Manage the IIT Ropar FAQ community platform</p>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout}>Log Out</button>
      </div>

      <div className="tab-switcher mb-lg" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {role === 'super_admin' && (
          <button className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('analytics')}>
            📊 Analytics
          </button>
        )}
        <button className={`btn ${activeTab === 'escalated' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('escalated')}>
          🚨 Escalated Queries
        </button>
        <button className={`btn ${activeTab === 'faqs' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('faqs')}>
          📚 Manage FAQs
        </button>
        {role === 'super_admin' && (
          <button className={`btn ${activeTab === 'admins' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('admins')}>
            👥 Admin Accounts
          </button>
        )}
      </div>

      {activeTab === 'analytics' && role === 'super_admin' && (
        <div className="glass-card" style={{ animation: 'slideUp 0.3s ease' }}>
          <div className="section-title"><span className="section-title-icon">📊</span> Platform Analytics</div>

          {loadingAnalytics ? (
            <div className="skeleton skeleton-text" style={{ height: '200px' }} />
          ) : analytics ? (
            <>
              {/* Overall stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '20px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-orange)' }}>{analytics.overall.queriesTracker.total}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Total Queries</div>
                </div>
                <div style={{ padding: '20px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-green-light)' }}>{analytics.overall.resolutionRate}%</div>
                  <div style={{ color: 'var(--text-muted)' }}>Resolution Rate</div>
                </div>
                <div style={{ padding: '20px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--purple-light)' }}>{analytics.overall.avgResolutionHours}h</div>
                  <div style={{ color: 'var(--text-muted)' }}>Avg Resolution Time</div>
                </div>
                <div style={{ padding: '20px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{analytics.overall.totalFaqs}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Generated FAQs</div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Query Status Breakdown</h3>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="badge badge-active" style={{ fontSize: '1rem', padding: '8px 16px' }}>Active: {analytics.overall.queriesTracker.active}</div>
                  <div className="badge badge-review" style={{ fontSize: '1rem', padding: '8px 16px' }}>In Review: {analytics.overall.queriesTracker.inReview}</div>
                  <div className="badge badge-warning" style={{ background: '#fef9c3', color: '#854d0e', fontSize: '1rem', padding: '8px 16px' }}>Escalated: {analytics.overall.queriesTracker.escalated}</div>
                  <div className="badge badge-resolved" style={{ fontSize: '1rem', padding: '8px 16px' }}>Resolved: {analytics.overall.queriesTracker.resolved}</div>
                </div>
              </div>

              {/* Individual Users */}
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Top Contributors</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-glass-strong)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>Username</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Queries Raised</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>Queries Answered</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.individual.slice(0, 10).map((u: any) => (
                    <tr key={u.username} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px' }}>{u.username}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{u.queriesRaised}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{u.queriesAnswered}</td>
                    </tr>
                  ))}
                  {analytics.individual.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No user activity yet</td></tr>
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <div>Failed to load analytics</div>
          )}
        </div>
      )}

      {activeTab === 'escalated' && (
        <div className="glass-card" style={{ animation: 'slideUp 0.3s ease' }}>
          <div className="section-title"><span className="section-title-icon">🚨</span> Escalated Queries</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
            These queries were escalated by users. Answering them will automatically resolve the query and embed it into the Qdrant FAQ knowledge base.
          </p>

          {loadingEscalated ? (
            <div className="skeleton skeleton-text" style={{ height: '100px' }} />
          ) : escalated.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {escalated.map(q => (
                <div key={q._id} style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{q.ticketId}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(q.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>{q.question}</h3>

                  {answerTarget?._id === q._id ? (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                      <textarea
                        className="input textarea"
                        placeholder="Write the official answer here..."
                        value={escalatedAnswer}
                        onChange={(e) => setEscalatedAnswer(e.target.value)}
                        rows={4}
                        style={{ marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleResolveEscalated} disabled={answering || !escalatedAnswer.trim()}>
                          {answering ? 'Submitting...' : 'Resolve & Add to FAQs'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setAnswerTarget(null); setEscalatedAnswer(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary btn-sm" onClick={() => setAnswerTarget(q)}>Answer Query</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <h3>All clear!</h3>
              <p>No queries require admin escalation right now.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'faqs' && (
        <div className="admin-dashboard">
          <div className="glass-card glass-card-accent" style={{ animation: 'slideUp 0.5s ease' }} id="add-faq-section">
            <div className="section-title"><span className="section-title-icon">➕</span> Add New FAQ</div>
            <form onSubmit={handleAddFaq}>
              {addError && <div className="error-alert">{addError}</div>}
              {addMessage && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', color: 'var(--accent-green-light)',
                  fontSize: '0.9rem', marginBottom: 'var(--space-md)',
                }}>
                  {addMessage}
                </div>
              )}
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="faq-question">Question</label>
                <textarea id="faq-question" className="input textarea" placeholder="Enter the FAQ question..." value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} required />
              </div>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="faq-answer">Answer</label>
                <textarea id="faq-answer" className="input textarea" placeholder="Enter the FAQ answer..." value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} required />
              </div>
              <div className="input-group mb-lg">
                <label className="input-label" htmlFor="faq-category">Category (optional)</label>
                <input id="faq-category" className="input" type="text" placeholder="e.g. Academics, Hostel" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={adding || !question.trim() || !answer.trim()}>
                {adding ? 'Adding...' : '📝 Add FAQ & Embed'}
              </button>
            </form>
          </div>

          <div className="glass-card" style={{ animation: 'slideUp 0.5s ease 0.1s both' }}>
            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <div className="flex items-center gap-sm"><span className="section-title-icon">📋</span> Manage FAQs</div>
              <span className="badge badge-review">{faqs.length} total</span>
            </div>
            {loadingFaqs ? (
              <div className="admin-faq-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                    <div className="skeleton skeleton-title" />
                  </div>
                ))}
              </div>
            ) : faqs.length > 0 ? (
              <div className="admin-faq-list">
                {faqs.map((faq) => (
                  <div key={faq._id} className="admin-faq-item" style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div className="admin-faq-content">
                      <div className="admin-faq-question">{faq.question}</div>
                      <div className="admin-faq-answer">{faq.answer}</div>
                      {faq.category && <span className="badge badge-review" style={{ marginTop: '8px', display: 'inline-flex' }}>{faq.category}</span>}
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteTarget(faq)} title="Delete FAQ" style={{ flexShrink: 0 }}>🗑️</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>No FAQs</h3>
                <p>Add your first FAQ using the form on the left.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'admins' && role === 'super_admin' && (
        <div className="admin-dashboard">
          <div className="glass-card glass-card-accent" style={{ animation: 'slideUp 0.5s ease' }}>
            <div className="section-title"><span className="section-title-icon">➕</span> Create Admin</div>
            <form onSubmit={handleCreateAdmin}>
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="new-admin-user">Username</label>
                <input id="new-admin-user" className="input" type="text" placeholder="Admin username" value={newAdminUser} onChange={(e) => setNewAdminUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} minLength={3} maxLength={30} required />
              </div>
              <div className="input-group mb-lg">
                <label className="input-label" htmlFor="new-admin-pass">Password</label>
                <input id="new-admin-pass" className="input" type="password" placeholder="Admin password" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} minLength={6} required />
              </div>
              <button type="submit" className="btn btn-success w-full" disabled={creatingAdmin || !newAdminUser || newAdminPass.length < 6}>
                {creatingAdmin ? 'Creating...' : 'Create Admin Account'}
              </button>
            </form>
          </div>

          <div className="glass-card" style={{ animation: 'slideUp 0.5s ease 0.1s both' }}>
            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <div className="flex items-center gap-sm"><span className="section-title-icon">👥</span> Manage Accounts</div>
              <span className="badge badge-review">{adminsList.length} total</span>
            </div>

            {loadingAdmins ? (
              <div className="skeleton skeleton-text" style={{ height: '60px' }} />
            ) : adminsList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {adminsList.map(admin => (
                  <div key={admin._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{admin.username}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Admin Role</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAdmin(admin._id)}>Revoke Access</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No admin accounts created yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete FAQ"
          message={`Are you sure you want to delete "${deleteTarget.question}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          variant="danger"
        />
      )}
    </div>
  );
}
