'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<{ username: string } | null>(null);

  const isAdmin = pathname.startsWith('/admin');

  // Check auth state on mount and pathname changes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/verify');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
            return;
          }
        }
        setUser(null);
      } catch {
        // Ignore errors
      }
    };
    checkAuth();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors
    }
    setUser(null);
  };

  const links = [
    { href: '/', label: 'Browse FAQs', icon: '📚' },
    { href: '/raise-query', label: 'Raise a Query', icon: '✋' },
    { href: '/solve-query', label: 'Solve a Query', icon: '💡' },
  ];

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <div className="navbar-brand-icon">R</div>
          <div className="navbar-brand-text">
            IIT Ropar <span>FAQ</span>
          </div>
        </Link>

        <button
          className="navbar-toggle"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
          id="navbar-toggle-btn"
        >
          {isOpen ? '✕' : '☰'}
        </button>

        <div className={`navbar-links ${isOpen ? 'open' : ''}`}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
              id={`nav-link-${link.href.replace('/', '') || 'home'}`}
            >
              <span className="nav-link-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}

          {user ? (
            <div className="nav-user-pill">
              <div className="nav-user-avatar">{user.username[0].toUpperCase()}</div>
              <span className="nav-user-name">{user.username}</span>
              <button className="nav-logout-btn" onClick={handleLogout} title="Logout" id="nav-logout-btn">
                ↗
              </button>
            </div>
          ) : (
            <Link
              href="/admin"
              className="nav-link nav-link-admin"
              onClick={() => setIsOpen(false)}
              id="nav-link-admin"
            >
              {pathname.startsWith('/admin') ? '⚙️ Dashboard' : '🔒 Admin'}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
