'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  subcategory?: string;
  createdAt: string;
  isEmbedded?: boolean;
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
  upvotes?: number;
  autoEscalated?: boolean;
}

type TabMode = 'faqs' | 'escalated' | 'analytics' | 'admins' | 'vector-db' | 'categories';

// Utility: clean up FAQ question text for display
// Removes § symbols, strips leading section numbering (e.g. "1.2", "2.3.1"), and capitalizes first letter
function cleanQuestion(text: string): string {
  let cleaned = text
    .replace(/§/g, '')                    // Remove § symbol
    .replace(/^\s*\d+(\.\d+)*\.?\s*/g, '') // Remove leading numbering like "1.2", "1.2.3", "1."
    .trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

// Utility: clean up FAQ answer text for display
// Removes § symbols, and capitalizes first letter
function cleanAnswer(text: string): string {
  let cleaned = text.replace(/§/g, '').trim();
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<'super_admin' | 'admin' | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabMode>('escalated');

  // Categories state
  const [dynamicCategories, setDynamicCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState('');
  const [catMessage, setCatMessage] = useState('');
  const [catError, setCatError] = useState('');
  const [managingCategory, setManagingCategory] = useState<string | null>(null);

  // FAQ state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
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

  // Vector DB state
  const [vectorFaqs, setVectorFaqs] = useState<FAQ[]>([]);
  const [loadingVectorFaqs, setLoadingVectorFaqs] = useState(true);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [vectorSearchQuery, setVectorSearchQuery] = useState('');
  const [vectorMessage, setVectorMessage] = useState('');
  const [vectorError, setVectorError] = useState('');

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

  const fetchVectorFaqs = useCallback(async () => {
    if (role !== 'super_admin') return;
    setLoadingVectorFaqs(true);
    try {
      const res = await fetch('/api/admin/vector-faqs');
      const data = await res.json();
      setVectorFaqs(data.faqs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVectorFaqs(false);
    }
  }, [role]);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/admin/categories');
      if (res.ok) {
        const data = await res.json();
        setDynamicCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchCategories();
      if (activeTab === 'faqs') fetchFaqs();
      if (activeTab === 'escalated') fetchEscalated();
      if (activeTab === 'analytics') fetchAnalytics();
      if (activeTab === 'admins') fetchAdmins();
      if (activeTab === 'vector-db') fetchVectorFaqs();
    }
  }, [authenticated, activeTab, fetchFaqs, fetchEscalated, fetchAnalytics, fetchAdmins, fetchVectorFaqs, fetchCategories]);

  // Actions
  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setAdding(true); setAddError(''); setAddMessage('');
    try {
      const res = await fetch('/api/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim(), category: category.trim(), subcategory: subcategory.trim() }),
      });
      if (res.ok) {
        setAddMessage('✅ FAQ added and synchronized with Qdrant successfully!');
        setQuestion(''); setAnswer(''); setCategory(''); setSubcategory('');
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

  const handleStartEdit = (faq: FAQ) => {
    setEditingFaq(faq._id);
    setEditQuestion(cleanQuestion(faq.question));
    setEditAnswer(cleanAnswer(faq.answer));
    setEditCategory(faq.category || '');
    setEditSubcategory(faq.subcategory || '');
    setVectorMessage('');
    setVectorError('');
  };

  const handleCancelEdit = () => {
    setEditingFaq(null);
    setEditQuestion('');
    setEditAnswer('');
    setEditCategory('');
    setEditSubcategory('');
  };

  const handleSaveEdit = async () => {
    if (!editingFaq || !editQuestion.trim() || !editAnswer.trim()) return;
    setSavingEdit(true);
    setVectorMessage('');
    setVectorError('');
    try {
      const res = await fetch('/api/admin/vector-faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFaq,
          question: editQuestion.trim(),
          answer: editAnswer.trim(),
          category: editCategory.trim(),
          subcategory: editSubcategory.trim(),
        }),
      });
      if (res.ok) {
        setVectorMessage('✅ FAQ updated and re-embedded in vector database successfully!');
        setEditingFaq(null);
        setEditQuestion('');
        setEditAnswer('');
        setEditCategory('');
        setEditSubcategory('');
        fetchVectorFaqs();
        setTimeout(() => setVectorMessage(''), 4000);
      } else {
        const data = await res.json();
        setVectorError(data.error || 'Failed to update FAQ');
      }
    } catch {
      setVectorError('Network error while updating FAQ');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_category', name: newCategoryName }),
      });
      const data = await res.json();
      if (res.ok) {
        setCatMessage(data.message);
        setNewCategoryName('');
        fetchCategories();
        setTimeout(() => setCatMessage(''), 3000);
      } else {
        setCatError(data.error);
        setTimeout(() => setCatError(''), 3000);
      }
    } catch {
      setCatError('Network error');
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the category "${name}"? All FAQs in this category will be moved to "Other".`)) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_category', categoryName: name }),
      });
      const data = await res.json();
      if (res.ok) {
        setCatMessage(data.message);
        fetchCategories();
        if (activeTab === 'faqs') fetchFaqs();
        setTimeout(() => setCatMessage(''), 3000);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Network error');
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryForSub || !newSubcategoryName.trim()) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_subcategory', categoryName: selectedCategoryForSub, subcategoryName: newSubcategoryName }),
      });
      const data = await res.json();
      if (res.ok) {
        setCatMessage(data.message);
        setNewSubcategoryName('');
        fetchCategories();
        setTimeout(() => setCatMessage(''), 3000);
      } else {
        setCatError(data.error);
        setTimeout(() => setCatError(''), 3000);
      }
    } catch {
      setCatError('Network error');
    }
  };

  const handleDeleteSubcategory = async (categoryName: string, subcategoryName: string) => {
    if (!confirm(`Are you sure you want to delete subcategory "${subcategoryName}"?`)) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_subcategory', categoryName, subcategoryName }),
      });
      const data = await res.json();
      if (res.ok) {
        setCatMessage(data.message);
        fetchCategories();
        setTimeout(() => setCatMessage(''), 3000);
      } else {
        alert(data.error);
      }
    } catch {
      alert('Network error');
    }
  };

  const filteredVectorFaqs = vectorFaqs.filter((faq) => {
    if (!vectorSearchQuery.trim()) return true;
    const q = vectorSearchQuery.toLowerCase();
    return (
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q) ||
      (faq.category || '').toLowerCase().includes(q) ||
      (faq.subcategory || '').toLowerCase().includes(q)
    );
  });

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
          <button className={`btn ${activeTab === 'vector-db' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('vector-db')}>
            🧠 Vector DB
          </button>
        )}
        {role === 'super_admin' && (
          <button className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('categories')}>
            📁 Categories
          </button>
        )}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{q.ticketId}</span>
                      {q.status === 'escalated' ? (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                          🚨 Escalated {q.autoEscalated ? '(Auto)' : ''}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'rgba(139, 92, 246, 1)', border: '1px solid rgba(139, 92, 246, 0.2)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                          👍 10+ Upvotes Review
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(q.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>{cleanQuestion(q.question)}</h3>

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
              <div className="input-group mb-md">
                <label className="input-label" htmlFor="faq-category">Category</label>
                <select
                  id="faq-category"
                  className="input"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSubcategory('');
                  }}
                >
                  <option value="">Select a category...</option>
                  {dynamicCategories.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group mb-lg">
                <label className="input-label" htmlFor="faq-subcategory">Subcategory</label>
                <select
                  id="faq-subcategory"
                  className="input"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  disabled={!category}
                >
                  <option value="">Select a subcategory...</option>
                  {category && dynamicCategories.find(c => c.name === category)?.subcategories.map((sub: string) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
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
                      <div className="admin-faq-question">{cleanQuestion(faq.question)}</div>
                      <div className="admin-faq-answer">{cleanAnswer(faq.answer)}</div>
                      {(faq.category || faq.subcategory) && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          {faq.category && <span className="badge badge-review">{faq.category}</span>}
                          {faq.subcategory && <span className="badge" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{faq.subcategory}</span>}
                        </div>
                      )}
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

      {activeTab === 'vector-db' && role === 'super_admin' && (
        <div className="glass-card" style={{ animation: 'slideUp 0.3s ease' }}>
          <div className="section-title" style={{ justifyContent: 'space-between' }}>
            <div className="flex items-center gap-sm"><span className="section-title-icon">🧠</span> Vector Database FAQs</div>
            <span className="badge badge-review">{vectorFaqs.length} embedded</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
            Browse and edit FAQs stored in the Qdrant vector database. Saving changes will automatically re-generate embeddings for accurate semantic search.
          </p>

          {vectorMessage && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', color: 'var(--accent-green-light)',
              fontSize: '0.9rem', marginBottom: 'var(--space-md)',
            }}>
              {vectorMessage}
            </div>
          )}
          {vectorError && <div className="error-alert" style={{ marginBottom: 'var(--space-md)' }}>{vectorError}</div>}

          {/* Search / Filter Bar */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                className="input input-search"
                type="text"
                placeholder="Filter FAQs by question, answer, or category..."
                value={vectorSearchQuery}
                onChange={(e) => setVectorSearchQuery(e.target.value)}
                id="vector-db-search"
              />
            </div>
          </div>

          {loadingVectorFaqs ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-text" style={{ marginTop: '8px', height: '40px' }} />
                </div>
              ))}
            </div>
          ) : filteredVectorFaqs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredVectorFaqs.map((faq) => (
                <div
                  key={faq._id}
                  style={{
                    padding: '20px',
                    border: editingFaq === faq._id ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: editingFaq === faq._id ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-glass)',
                    transition: 'all var(--transition-base)',
                  }}
                  id={`vector-faq-${faq._id}`}
                >
                  {editingFaq === faq._id ? (
                    /* Inline Edit Form */
                    <div style={{ animation: 'slideDown 0.2s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-blue-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✏️ Editing FAQ</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--bg-glass)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>ID: {faq._id.slice(-8)}</span>
                      </div>
                      <div className="input-group mb-md">
                        <label className="input-label">Question</label>
                        <textarea
                          className="input textarea"
                          value={editQuestion}
                          onChange={(e) => setEditQuestion(e.target.value)}
                          rows={3}
                          id={`edit-question-${faq._id}`}
                        />
                      </div>
                      <div className="input-group mb-md">
                        <label className="input-label">Answer</label>
                        <textarea
                          className="input textarea"
                          value={editAnswer}
                          onChange={(e) => setEditAnswer(e.target.value)}
                          rows={5}
                          id={`edit-answer-${faq._id}`}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="input-group">
                          <label className="input-label">Category</label>
                          <select
                            className="input"
                            value={editCategory}
                            onChange={(e) => { setEditCategory(e.target.value); setEditSubcategory(''); }}
                            id={`edit-category-${faq._id}`}
                          >
                            <option value="">Select a category...</option>
                            {dynamicCategories.map(cat => (
                              <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="input-label">Subcategory</label>
                          <select
                            className="input"
                            value={editSubcategory}
                            onChange={(e) => setEditSubcategory(e.target.value)}
                            disabled={!editCategory}
                            id={`edit-subcategory-${faq._id}`}
                          >
                            <option value="">Select a subcategory...</option>
                            {editCategory && dynamicCategories.find(c => c.name === editCategory)?.subcategories.map((sub: string) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleSaveEdit}
                          disabled={savingEdit || !editQuestion.trim() || !editAnswer.trim()}
                          id={`save-edit-${faq._id}`}
                        >
                          {savingEdit ? (
                            <><span className="search-spinner" style={{ position: 'static', width: '14px', height: '14px', marginRight: '6px' }} /> Saving & Re-embedding...</>
                          ) : (
                            '💾 Save & Re-embed'
                          )}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit} disabled={savingEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* Display View */
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '8px', lineHeight: 1.4 }}>{cleanQuestion(faq.question)}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '12px' }}>{cleanAnswer(faq.answer)}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            {faq.category && <span className="badge badge-review">{faq.category}</span>}
                            {faq.subcategory && <span className="badge" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{faq.subcategory}</span>}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                              🧬 {String(faq._id).slice(-8)}
                            </span>
                            {faq.isEmbedded === false && (
                              <span className="not-embedded-badge">
                                ⚠️ Not in Vector DB
                              </span>
                            )}
                            {faq.createdAt && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(faq.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartEdit(faq)}
                          style={{ flexShrink: 0 }}
                          id={`edit-btn-${faq._id}`}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🧠</div>
              <h3>{vectorSearchQuery ? 'No matching FAQs' : 'No Vector FAQs'}</h3>
              <p>{vectorSearchQuery ? 'Try adjusting your search filter.' : 'No FAQs are currently embedded in the vector database.'}</p>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete FAQ"
          message={`Are you sure you want to delete "${cleanQuestion(deleteTarget.question)}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          variant="danger"
        />
      )}
      {activeTab === 'categories' && role === 'super_admin' && (
        <div className="admin-dashboard">
          <div className="glass-card" style={{ animation: 'slideUp 0.5s ease' }}>
            <div className="section-title">
              <span className="section-title-icon">📁</span> 
              {managingCategory ? `Manage Subcategories: ${managingCategory}` : 'Manage Categories'}
            </div>
            
            {catMessage && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '8px', color: 'var(--accent-green-light)', marginBottom: '16px' }}>
                {catMessage}
              </div>
            )}
            {catError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', color: 'var(--accent-red-light)', marginBottom: '16px' }}>
                {catError}
              </div>
            )}

            {managingCategory ? (
              /* --- DRILL DOWN VIEW --- */
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setManagingCategory(null)}
                  >
                    ← Back to Categories
                  </button>
                </div>
                
                <div style={{ padding: '24px', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px solid var(--border-subtle)', marginBottom: '32px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Add New Subcategory</h3>
                  <form onSubmit={(e) => { setSelectedCategoryForSub(managingCategory); handleAddSubcategory(e); }} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input className="input" type="text" placeholder="Subcategory Name (e.g. Health Insurance)" value={newSubcategoryName} onChange={(e) => setNewSubcategoryName(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap', alignSelf: 'stretch' }}>Add Subcategory</button>
                  </form>
                </div>

                <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 600 }}>Existing Subcategories</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {dynamicCategories.find(c => c.name === managingCategory)?.subcategories.map((sub: string) => (
                    <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-glass)', borderRadius: '12px', border: '1px solid var(--border-subtle)', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)' }}>{sub}</span>
                      {dynamicCategories.find(c => c.name === managingCategory)?.subcategories.length > 1 && (
                        <button 
                          className="btn btn-ghost btn-sm btn-icon" 
                          onClick={() => handleDeleteSubcategory(managingCategory, sub)}
                          title="Delete Subcategory"
                          style={{ color: 'var(--accent-red-light)', opacity: 0.8 }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* --- MAIN CATEGORIES GRID VIEW --- */
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ padding: '20px', background: 'var(--bg-glass)', borderRadius: '16px', border: '1px solid var(--border-subtle)', marginBottom: '32px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Create New Category</h3>
                  <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                      <input className="input" type="text" placeholder="Category Name (e.g. Financial Aid)" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap', alignSelf: 'stretch' }}>Add Category</button>
                  </form>
                </div>

                <div className="category-grid">
                  {dynamicCategories.map(cat => {
                    const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    
                    return (
                      <div 
                        key={cat.name} 
                        className="category-card" 
                        data-category={slug}
                        onClick={() => setManagingCategory(cat.name)}
                        role="button"
                        tabIndex={0}
                        style={{ display: 'flex', flexDirection: 'column' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div className="category-card-icon" style={{ background: cat.gradient || 'var(--accent-blue)', marginBottom: '16px' }}>
                            {cat.icon}
                          </div>
                          {cat.name !== 'Other' && (
                            <button 
                              className="btn btn-ghost btn-sm btn-icon" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.name); }} 
                              title="Delete Category" 
                              style={{ color: 'var(--accent-red-light)', opacity: 0.7 }}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        
                        <div className="category-card-title" style={{ marginBottom: '8px' }}>{cat.name}</div>
                        <div className="category-card-desc" style={{ marginBottom: '16px', flex: 1 }}>{cat.description || 'Click to manage subcategories'}</div>
                        
                        <div className="category-card-footer" style={{ marginTop: 'auto' }}>
                          <div className="category-card-count">
                            <span className="count-number">{cat.subcategories.length}</span> Subcategories
                          </div>
                          <div className="category-card-arrow">→</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
