// src/components/SubscribePopup.jsx
//
// NAVY "Thanks for Subscribing" popup with the three social links.
// Opens AFTER a successful subscribe (new signup OR "already subscribed").
// Plain React + inline styles: no Tailwind, no external icons, no deps —
// works with any styling setup you have.
//
// USAGE (see subscribe-popup/README.md for the full wiring):
//   import SubscribePopup from '@/components/SubscribePopup';
//   const [showThanks, setShowThanks] = useState(false);
//   ...
//   <SubscribePopup
//     open={showThanks}
//     onClose={() => setShowThanks(false)}
//     socials={socials}   // optional: from the API response {facebook, whatsapp, telegram}
//   />
'use client';   // Next.js App Router: this is an interactive component

import { useEffect } from 'react';

// Fallback links — same URLs the API returns and the email contains.
// The API response (route.js now returns `socials`) overrides these, so the
// popup always matches whatever links your backend sends.
const FALLBACK_SOCIALS = {
  facebook: { label: 'Facebook', url: 'https://web.facebook.com/newsshore' },
  whatsapp: { label: 'WhatsApp', url: 'https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32' },
  telegram: { label: 'Telegram', url: 'https://t.me/News_Shore' },
};

// Brand colors — each button carries its platform's real brand color,
// everything else in the card is navy (#0f1b3d, same as your email header).
const BRAND = {
  facebook: '#1877F2',   // Facebook blue
  whatsapp: '#25D366',    // WhatsApp green
  telegram: '#229ED9',   // Telegram blue
};

// Inline SVG icons (16px, white stroke) — no icon library needed.
const ICONS = {
  facebook: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8.2h2.76l.41-3.2H13.5V7.55c0-.93.26-1.56 1.6-1.56h1.71V3.15c-.3-.04-1.31-.13-2.49-.13-2.46 0-4.15 1.5-4.15 4.26v2.32H7.4v3.2h2.77V21h3.33z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.68 13.65L3 21l4.5-1.28A9 9 0 1 0 12 3zm0 2a7 7 0 0 1 0 14 7 7 0 0 1-3.57-.98l-.27-.16-2.67.76.77-2.6-.17-.28A7 7 0 0 1 12 5zm-2.93 3.4c-.17 0-.45.06-.68.31-.24.26-.9.88-.9 2.14 0 1.27.92 2.49 1.05 2.66.13.17 1.8 2.87 4.44 3.87 2.2.83 2.65.67 3.13.62.48-.05 1.55-.63 1.77-1.25.22-.62.22-1.14.15-1.25-.06-.11-.24-.17-.5-.3-.27-.13-1.55-.76-1.79-.85-.24-.09-.41-.13-.59.13-.17.26-.68.86-.83 1.03-.15.18-.3.2-.56.07-.26-.13-1.1-.4-2.1-1.29-.78-.69-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.27-.3.4-.46.13-.15.17-.26.26-.43.09-.18.04-.33-.02-.46-.07-.13-.6-1.44-.82-1.97-.22-.52-.44-.45-.6-.46l-.5-.01z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.6 18.9 19c-.22 1-.8 1.25-1.63.78l-4.5-3.32-2.17 2.09c-.24.24-.44.44-.9.44l.33-4.63 8.4-7.58c.36-.32-.08-.5-.56-.18L7.66 13.28l-4.4-1.37c-.96-.3-.98-.96.2-1.42L20.36 3.1c.8-.3 1.5.18 1.24 1.5h.3z" />
    </svg>
  ),
};

export default function SubscribePopup({ open, onClose, socials }) {
  // Lock body scroll + close on Escape while the popup is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const s = { ...FALLBACK_SOCIALS, ...(socials || {}) };

  const buttonStyle = (key) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '13px 18px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    background: BRAND[key],
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
    textDecoration: 'none',
    transition: 'filter .15s ease, transform .15s ease',
  });

  const rowStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(5, 10, 25, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'sp-fade .25s ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-popup-title"
    >
      {/* ---- navy card ---- */}
      <div
        style={{
          background: '#0f1b3d',
          color: '#fff',
          borderRadius: '16px',
          boxSizing: 'border-box',
          width: '100%',
          width: '100%',
          maxWidth: '380px',
          padding: '32px 28px 26px',
          boxShadow: '0 24px 60px rgba(0,0,0,.45)',
          border: '1px solid rgba(255,255,255,.08)',
          textAlign: 'center',
          fontFamily: 'inherit',
          animation: 'sp-pop .28s cubic-bezier(.34,1.4,.64,1)',
          position: 'relative',
        }}
      >
        {/* close X */}
        <button
          onClick={() => onClose?.()}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,.1)',
            color: '#fff',
            fontSize: '16px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* check circle */}
        <div
          style={{
            width: '54px',
            height: '54px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'rgba(37, 211, 102, .15)',
            border: '1.5px solid #25D366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#25D366" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4.5 12.5l5 5 10-11" />
          </svg>
        </div>

        <h2 id="subscribe-popup-title" style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, letterSpacing: '.2px' }}>
          Thanks for Subscribing!
        </h2>
        <p style={{ margin: '0 0 22px', fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,.75)' }}>
          You&apos;re on the list — the tech stories that matter will land in your inbox.
          Stay connected on our socials:
        </p>

        {/* ---- the three social buttons: Facebook, WhatsApp, Telegram ---- */}
        <div style={rowStyle}>
          <a href={s.facebook.url} target="_blank" rel="noopener noreferrer" style={buttonStyle('facebook')}
             onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
             onMouseOut={(e) => (e.currentTarget.style.filter = 'none')}>
            {ICONS.facebook}
            <span style={{ flex: 1, textAlign: 'left' }}>Join us on Facebook</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
          </a>

          <a href={s.whatsapp.url} target="_blank" rel="noopener noreferrer" style={buttonStyle('whatsapp')}
             onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
             onMouseOut={(e) => (e.currentTarget.style.filter = 'none')}>
            {ICONS.whatsapp}
            <span style={{ flex: 1, textAlign: 'left' }}>Join us on WhatsApp</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
          </a>

          <a href={s.telegram.url} target="_blank" rel="noopener noreferrer" style={buttonStyle('telegram')}
             onMouseOver={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
             onMouseOut={(e) => (e.currentTarget.style.filter = 'none')}>
            {ICONS.telegram}
            <span style={{ flex: 1, textAlign: 'left' }}>Join us on Telegram</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
          </a>
        </div>

        <button
          onClick={() => onClose?.()}
          style={{
            marginTop: '18px',
            width: '100%',
            padding: '11px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,.25)',
            background: 'transparent',
            color: 'rgba(255,255,255,.85)',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Maybe later
        </button>
      </div>

      {/* keyframes injected once per page */}
      <style>{`
        @keyframes sp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sp-pop  { from { opacity: 0; transform: scale(.9) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @media (max-width: 640px) {
          @keyframes sp-pop { from { opacity: 0; transform: scale(.95) translateY(20px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        }
      `}</style>
    </div>
  );
}
