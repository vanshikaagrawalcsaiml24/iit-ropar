'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import SearchBar from '@/components/SearchBar';
import FAQCard from '@/components/FAQCard';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  subcategory?: string;
  createdAt?: string;
}

interface SubcategoryInfo {
  name: string;
  faqCount: number;
}

interface CategoryInfo {
  name: string;
  icon: string;
  gradient: string;
  description: string;
  faqCount: number;
  subcategories: SubcategoryInfo[];
}

type ViewLevel = 'categories' | 'subcategories' | 'faqs';

/** Slugify a category name for data-attribute matching */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function Home() {
  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>('categories');
  const [selectedCategory, setSelectedCategory] = useState<CategoryInfo | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryInfo | null>(null);

  // Data state
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [searchResults, setSearchResults] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  // For animation key
  const [animKey, setAnimKey] = useState(0);

  // Ref for SearchBar reset
  const searchBarRef = useRef<{ clear: () => void }>(null);

  // Fetch category hierarchy on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const res = await fetch('/api/faqs/categories');
        const data = await res.json();
        setCategories(data.categories || []);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch FAQs for a specific subcategory
  const fetchSubcategoryFaqs = useCallback(async (categoryName: string, subcategoryName: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/faqs?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(subcategoryName)}`
      );
      const data = await res.json();
      setFaqs(data.faqs || []);
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearchMode(true);
      setLoading(true);
      try {
        const res = await fetch(`/api/faqs?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSearchResults(data.faqs || []);
      } catch (error) {
        console.error('Failed to search FAQs:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setIsSearchMode(false);
      setSearchResults([]);
    }
  }, []);

  // Navigation handlers
  const handleCategoryClick = (cat: CategoryInfo) => {
    setSelectedCategory(cat);
    setViewLevel('subcategories');
    setAnimKey((k) => k + 1);
    // Clear search
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubcategoryClick = (sub: SubcategoryInfo) => {
    if (!selectedCategory) return;
    setSelectedSubcategory(sub);
    setViewLevel('faqs');
    setAnimKey((k) => k + 1);
    fetchSubcategoryFaqs(selectedCategory.name, sub.name);
  };

  const navigateToCategories = () => {
    setViewLevel('categories');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setFaqs([]);
    setAnimKey((k) => k + 1);
  };

  const navigateToSubcategories = () => {
    setViewLevel('subcategories');
    setSelectedSubcategory(null);
    setFaqs([]);
    setAnimKey((k) => k + 1);
  };

  const clearSearch = () => {
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Render breadcrumb
  const renderBreadcrumb = () => {
    if (viewLevel === 'categories') return null;

    return (
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span className="breadcrumb-item">
          <button className="breadcrumb-link" onClick={navigateToCategories} id="breadcrumb-home">
            🏠 Home
          </button>
        </span>

        {viewLevel === 'subcategories' && selectedCategory && (
          <>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item breadcrumb-current">
              {selectedCategory.icon} {selectedCategory.name}
            </span>
          </>
        )}

        {viewLevel === 'faqs' && selectedCategory && (
          <>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item">
              <button className="breadcrumb-link" onClick={navigateToSubcategories} id="breadcrumb-category">
                {selectedCategory.icon} {selectedCategory.name}
              </button>
            </span>
            {selectedSubcategory && (
              <>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-item breadcrumb-current">
                  {selectedSubcategory.name}
                </span>
              </>
            )}
          </>
        )}
      </nav>
    );
  };

  // Render Level 1: Category Cards
  const renderCategories = () => (
    <div className="level-enter" key={`categories-${animKey}`}>
      {categoriesLoading ? (
        <div className="category-grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="category-card" style={{ cursor: 'default' }}>
              <div className="skeleton" style={{ width: '56px', height: '56px', borderRadius: '16px', marginBottom: '16px' }} />
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '85%' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="category-card"
              data-category={slugify(cat.name)}
              onClick={() => handleCategoryClick(cat)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCategoryClick(cat);
                }
              }}
              id={`category-card-${slugify(cat.name)}`}
            >
              <div
                className="category-card-icon"
                style={{ background: cat.gradient }}
              >
                {cat.icon}
              </div>
              <div className="category-card-title">{cat.name}</div>
              <div className="category-card-desc">{cat.description}</div>
              <div className="category-card-footer">
                <div className="category-card-count">
                  <span className="count-number">{cat.faqCount}</span> FAQs
                </div>
                <div className="category-card-arrow">→</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Level 2: Subcategory Cards
  const renderSubcategories = () => {
    if (!selectedCategory) return null;

    return (
      <div className="level-enter" key={`subcategories-${animKey}`}>
        <button className="back-button" onClick={navigateToCategories} id="back-to-categories">
          <span className="back-button-icon">←</span>
          All Categories
        </button>

        <div className="subcategory-header">
          <div
            className="subcategory-header-icon"
            style={{ background: selectedCategory.gradient }}
          >
            {selectedCategory.icon}
          </div>
          <div className="subcategory-header-text">
            <h2>{selectedCategory.name}</h2>
            <p>{selectedCategory.description}</p>
          </div>
        </div>

        <div className="subcategory-grid">
          {selectedCategory.subcategories.map((sub) => (
            <div
              key={sub.name}
              className="subcategory-card"
              onClick={() => handleSubcategoryClick(sub)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSubcategoryClick(sub);
                }
              }}
              id={`subcategory-card-${slugify(sub.name)}`}
            >
              <div className="subcategory-card-left">
                <div
                  className="subcategory-card-dot"
                  style={{ background: selectedCategory.gradient }}
                />
                <span className="subcategory-card-name">{sub.name}</span>
              </div>
              <div className="subcategory-card-right">
                <span className="subcategory-card-badge">
                  {sub.faqCount} {sub.faqCount === 1 ? 'FAQ' : 'FAQs'}
                </span>
                <span className="subcategory-card-chevron">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render Level 3: FAQ Accordions
  const renderFaqList = () => {
    if (!selectedCategory || !selectedSubcategory) return null;

    return (
      <div className="level-enter" key={`faqs-${animKey}`}>
        <button className="back-button" onClick={navigateToSubcategories} id="back-to-subcategories">
          <span className="back-button-icon">←</span>
          {selectedCategory.name}
        </button>

        <div className="faq-level-header">
          <h2>{selectedSubcategory.name}</h2>
          <p>
            {faqs.length} {faqs.length === 1 ? 'question' : 'questions'} in{' '}
            {selectedCategory.name} › {selectedSubcategory.name}
          </p>
        </div>

        {loading ? (
          <div className="faq-accordion-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card" style={{ padding: '24px' }}>
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-text" style={{ width: '90%' }} />
                <div className="skeleton skeleton-text" style={{ width: '70%' }} />
              </div>
            ))}
          </div>
        ) : faqs.length > 0 ? (
          <div className="faq-accordion-list">
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
            <div className="empty-state-icon">📭</div>
            <h3>No FAQs Yet</h3>
            <p>No questions have been added to this subcategory yet.</p>
          </div>
        )}
      </div>
    );
  };

  // Render search results
  const renderSearchResults = () => (
    <div className="level-enter" key="search-results">
      <div className="search-results-header">
        <div>
          <h2>🔍 Search Results</h2>
          <span className="search-results-count">
            {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
          </span>
        </div>
        <button className="search-clear-btn" onClick={clearSearch} id="clear-search-btn">
          ✕ Clear Search
        </button>
      </div>

      {loading ? (
        <div className="faq-accordion-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card" style={{ padding: '24px' }}>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            </div>
          ))}
        </div>
      ) : searchResults.length > 0 ? (
        <div className="faq-accordion-list">
          {searchResults.map((faq) => (
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
          <div className="empty-state-icon">🔍</div>
          <h3>No Results Found</h3>
          <p>
            No FAQs match &ldquo;{searchQuery}&rdquo;. Try a different search term.
          </p>
        </div>
      )}
    </div>
  );

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
            placeholder="Search across all FAQs..."
            loading={loading && isSearchMode}
          />
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {!isSearchMode && renderBreadcrumb()}

      {/* Content Area */}
      {isSearchMode ? (
        renderSearchResults()
      ) : (
        <>
          {viewLevel === 'categories' && renderCategories()}
          {viewLevel === 'subcategories' && renderSubcategories()}
          {viewLevel === 'faqs' && renderFaqList()}
        </>
      )}
    </div>
  );
}