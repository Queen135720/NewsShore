'use client';

import { useState } from 'react';

const NAVY = '#0a2540'; // <- change the navy shade here if needed

// Main homepage navs (must match your home category names EXACTLY)
const CATEGORIES = ['Latest', 'AI News', 'Tech Giants', 'Tech News', 'Startups & Funding', 'Research', 'Deals', 'Global & China'];

// Secondary: the footer pages (delete this array + its block below for categories only)
const PAGES = [
  { href: '/careers', label: 'Careers' },
  { href: '/contact', label: 'Contact' },
  { href: '/advertise', label: 'Advertise' },
  { href: '/press-kit', label: 'Press Kit' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/accessibility', label: 'Accessibility' },
];

export default function PageHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: NAVY }}>
      <style>{`
        .ns-back:hover { background: rgba(255,255,255,0.12); }
        .ns-dots:hover { background: rgba(255,255,255,0.12); }
        .ns-menu a:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto', height: '64px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Back to News — top left */}
        <a href="/" className="ns-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#ffffff', textDecoration: 'none', fontSize: '15px', fontWeight: 600, padding: '8px 14px', borderRadius: '8px', transition: 'background 0.15s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
          Back to News
        </a>

        {/* Nine-dots menu — top right */}
        <div style={{ position: 'relative' }}>
          <button type="button" aria-label="Open menu" aria-expanded={open} className="ns-dots" onClick={() => setOpen(v => !v)}
            style={{ width: '40px', height: '40px', borderRadius: '9999px', border: '2px solid #ffffff', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#ffffff" aria-hidden="true">
              <circle cx="2" cy="2" r="1.7" /><circle cx="8" cy="2" r="1.7" /><circle cx="14" cy="2" r="1.7" />
              <circle cx="2" cy="8" r="1.7" /><circle cx="8" cy="8" r="1.7" /><circle cx="14" cy="8" r="1.7" />
              <circle cx="2" cy="14" r="1.7" /><circle cx="8" cy="14" r="1.7" /><circle cx="14" cy="14" r="1.7" />
            </svg>
          </button>

          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: -1 }} aria-hidden="true" />
              <nav className="ns-menu" style={{ position: 'absolute', top: '50px', right: 0, minWidth: '250px', maxHeight: '70vh', overflowY: 'auto', backgroundColor: NAVY, border: '1px solid rgba(255,255,255,0.18)', borderRadius: '12px', padding: '8px', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
                {CATEGORIES.map(c => (
                  <a key={c} href={'/?category=' + encodeURIComponent(c)} onClick={() => setOpen(false)} style={{ display: 'block', padding: '10px 14px', color: '#e2e8f0', textDecoration: 'none', fontSize: '14px', borderRadius: '8px' }}>{c}</a>
                ))}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 4px' }} />
                <div style={{ padding: '6px 14px 4px', color: 'rgba(255,255,255,0.45)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Company &amp; Legal</div>
                {PAGES.map(p => (
                  <a key={p.href} href={p.href} onClick={() => setOpen(false)} style={{ display: 'block', padding: '8px 14px', color: '#cbd5e1', textDecoration: 'none', fontSize: '13px', borderRadius: '8px' }}>{p.label}</a>
                ))}
              </nav>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
