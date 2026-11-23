// src/components/SubscribeForm.jsx
//
// COMPLETE drop-in subscribe form with the "Thanks for Subscribing" navy
// popup ALREADY WIRED. If you got no popup after subscribing, it's because
// your old form never rendered <SubscribePopup/> — replace your form with
// this file (or copy the 3 marked lines into your own form, see README).
//
// Behavior:
//   submit -> POST /api/subscribe
//     ok      -> save, popup opens            (first-time subscriber)
//     already -> save, popup opens            (repeat email — no 2nd mail)
//     error   -> inline red message, no popup
//   popup closes via X / Maybe later / Escape / backdrop click
//
// Plain React + inline styles. No Tailwind, no deps.
'use client';

import { useState } from 'react';
import SubscribePopup from './SubscribePopup';

export default function SubscribeForm({ source = 'site' } = {}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [message, setMessage] = useState('');
  const [socials, setSocials] = useState(null);
  const [showThanks, setShowThanks] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;

    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setStatus('sending');
    setMessage('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, source }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.ok || data.already)) {
        // ---- SUCCESS: popup opens here ----
        setSocials(data.socials || null);   // links from the API (same as email)
        setShowThanks(true);
        setStatus('done');
        setEmail('');
        return;
      }

      if (res.ok && data.error === 'server_config') {
        setStatus('error');
        setMessage('Subscriptions are temporarily unavailable — please try again later.');
        return;
      }

      setStatus('error');
      setMessage(
        data.error === 'invalid_email'
          ? 'Please enter a valid email address.'
          : 'Something went wrong — please try again.'
      );
    } catch {
      setStatus('error');
      setMessage('Network error — please check your connection and try again.');
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate style={{ width: '100%', maxWidth: '440px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (status === 'error') { setStatus('idle'); setMessage(''); } }}
            placeholder="Enter your email"
            aria-label="Email address"
            required
            style={{
              flex: '1 1 220px',
              padding: '12px 14px',
              fontSize: '15px',
              fontFamily: 'inherit',
              borderRadius: '10px',
              border: status === 'error' ? '1.5px solid #e5484d' : '1px solid #d4d7de',
              outline: 'none',
              background: '#fff',
              color: '#111',
            }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{
              flex: '0 0 auto',
              padding: '12px 22px',
              fontSize: '15px',
              fontWeight: 600,
              fontFamily: 'inherit',
              borderRadius: '10px',
              border: 'none',
              cursor: status === 'sending' ? 'default' : 'pointer',
              background: status === 'sending' ? '#0f1b3d' : '#0f1b3d',
              color: '#fff',
              opacity: status === 'sending' ? 0.75 : 1,
            }}
          >
            {status === 'sending' ? 'Subscribing…' : 'Subscribe'}
          </button>
        </div>

        {message && (
          <p style={{ margin: '10px 2px 0', fontSize: '13px', color: status === 'error' ? '#e5484d' : '#333', textAlign: 'left' }}>
            {message}
          </p>
        )}

        {status === 'done' && !showThanks && (
          <p style={{ margin: '10px 2px 0', fontSize: '13px', color: '#1d7a3d', textAlign: 'left' }}>
            You&apos;re on the list — check your inbox for the welcome mail.
          </p>
        )}
      </form>

      {/* THE POPUP — the line that was missing in your site */}
      <SubscribePopup
        open={showThanks}
        onClose={() => setShowThanks(false)}
        socials={socials}
      />
    </>
  );
}
