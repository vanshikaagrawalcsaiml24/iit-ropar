'use client';

import { useState, useCallback, useEffect } from 'react';
import SearchBar from '@/components/SearchBar';
import FAQCard from '@/components/FAQCard';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  createdAt?: string;
}

export default function Home() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFaqs = useCallback(async (query: string) => {
    setLoading(true);
    try {
      if (query.trim()) {
        const res = await fetch(`/api/faqs?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setFaqs(data.faqs || []);
      } else {
        // Do not list all FAQs when search is empty
        setFaqs([]);
      }
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs('');
  }, [fetchFaqs]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    fetchFaqs(query);
  }, [fetchFaqs]);

  return (
    <div className="content-wrapper">
      {/* Hero Section */}
      <div className="hero">
        <h1>
          Your Questions,{' '}
          <span className="highlight">Answered</span>
        </h1>
        <p>
          Browse frequently asked questions or search for answers. 
          Powered by the IIT Ropar community.
        </p>
        <div className="hero-search">
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search for answers..."
            loading={loading}
          />
        </div>
      </div>

      {/* FAQ Grid */}
      {initialLoad ? (
        <div className="faq-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card" style={{ padding: '24px' }}>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '90%' }} />
              <div className="skeleton skeleton-text" style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      ) : faqs.length > 0 ? (
        <div className="faq-grid">
          {faqs.map((faq) => (
            <FAQCard
              key={faq._id}
              question={faq.question}
              answer={faq.answer}
              category={faq.category}
              createdAt={faq.createdAt}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            {searchQuery ? '🔍' : '📭'}
          </div>
          <h3>{searchQuery ? 'No Results Found' : 'No FAQs Yet'}</h3>
          <p>
            {searchQuery
              ? `No FAQs match "${searchQuery}". Try a different search term.`
              : 'FAQs will appear here once the admin adds them.'}
          </p>
        </div>
      )}
    </div>
  );
}