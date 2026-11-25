'use client';

// ================================================================
// OneSignal web push init + on-page debugger — Next.js App Router.
//
// PUT THIS FILE AT:  src/components/OneSignalInit.tsx
//
// MOUNT IT ONCE in src/app/layout.tsx, inside <body>:
//
//     import OneSignalInit from '@/components/OneSignalInit';
//     ...
//     <body ...>
//       {children}
//       <OneSignalInit />
//       <Toaster />
//     </body>
//
// If <OneSignalInit /> is NOT in the layout, nothing below can
// happen — no bell, no prompt, no notifications. That is the #1
// cause of "nothing shows up after redeploy".
//
// ENV — set BEFORE `next build` (NEXT_PUBLIC_ values are baked
// into the built site at build time; adding them after does
// nothing until you rebuild):
//     NEXT_PUBLIC_ONESIGNAL_APP_ID=your OneSignal App ID
// Locally that is .env.local; on Vercel it is Project Settings →
// Environment Variables, then Redeploy.
//
// ALSO COPY OneSignalSDKWorker.js into public/ so it is served at
// /OneSignalSDKWorker.js.
//
// DEBUGGING — open any page with ?push-debug added to the URL,
// e.g. https://your-domain.com/?push-debug  (works on localhost
// too). A dark panel appears top-left and checks one step per
// line: component mounted → HTTPS → app id baked in → SDK loaded
// → init OK → push supported → subscription state. When needed it
// also shows a button "Show the permission prompt now".
// If NO panel appears at all, this component is not mounted in
// your layout — fix that first.
//
// v3: loads the SDK via next/script, calls init directly if the
// SDK somehow arrived first, adds the ?push-debug panel.
// (v2's bug — SDK never loaded — is fixed; v1 queued init with no
// script at all.)
// ================================================================

import { useEffect } from 'react';
import Script from 'next/script';

const SDK_SRC = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

type OneSignalApi = {
  init: (options: Record<string, unknown>) => Promise<void>;
  Notifications?: {
    isPushSupported: () => boolean;
    requestPermission: () => Promise<void>;
  };
  User?: { PushSubscription?: { optedIn?: boolean; id?: string } };
};

declare global {
  interface Window {
    OneSignal?: OneSignalApi;
    OneSignalDeferred?: Array<(api: OneSignalApi) => void>;
  }
}

// set once per browser page load — survives React strict-mode double mount
let initQueued = false;

export default function OneSignalInit() {
  useEffect(() => {
    if (initQueued) return;
    initQueued = true;

    const debug = /[?&]push-debug/.test(window.location.search);
    const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';

    // ---------- the ?push-debug overlay (DOM-based, no React state) ----------
    let listEl: HTMLUListElement | null = null;

    const step = (state: 'ok' | 'bad' | 'info' | 'wait', text: string) => {
      if (!debug) return;
      if (!listEl) {
        const panel = document.createElement('div');
        panel.style.cssText = [
          'position:fixed', 'top:12px', 'left:12px', 'z-index:2147483647',
          'max-width:440px', 'width:calc(100vw - 24px)', 'box-sizing:border-box',
          'background:#101010', 'color:#e5e5e5',
          'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
          'padding:12px 14px', 'border-radius:10px',
          'box-shadow:0 6px 24px rgba(0,0,0,.45)',
        ].join(';');
        const head = document.createElement('div');
        head.textContent = 'OneSignal push debug (?push-debug)';
        head.style.cssText = 'font-weight:700;color:#fff;margin-bottom:8px;';
        listEl = document.createElement('ul');
        listEl.style.cssText = 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;';
        panel.append(head, listEl);
        document.body.appendChild(panel);
      }
      const li = document.createElement('li');
      li.style.cssText = 'margin:0;padding:5px 7px;background:#1d1d1d;border-radius:6px;white-space:pre-wrap;word-break:break-word;';
      const icon = document.createElement('span');
      const map = {
        ok: ['✓', '#4ade80'],
        bad: ['✗', '#f87171'],
        info: ['·', '#93c5fd'],
        wait: ['…', '#fbbf24'],
      } as const;
      const [glyph, color] = map[state];
      icon.textContent = glyph + '  ';
      icon.style.color = color;
      li.appendChild(icon);
      li.appendChild(document.createTextNode(text));
      listEl.appendChild(li);
    };

    // ---------- init + post-init checks ----------
    const initOneSignal = async (OneSignal: OneSignalApi) => {
      try {
        await OneSignal.init({ appId: APP_ID, notifyButton: { enable: true } });
      } catch (e) {
        step('bad', `OneSignal.init() failed: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      step('ok', 'OneSignal initialised — the bell should now appear bottom-right.');

      const supported = OneSignal.Notifications?.isPushSupported?.() ?? false;
      step(supported ? 'ok' : 'bad', supported
        ? 'This browser supports web push.'
        : 'This browser does NOT support web push (or an extension blocks it).');

      const sub = OneSignal.User?.PushSubscription;
      if (sub?.id && sub.optedIn) {
        step('ok', `This browser IS subscribed (subscription id ${sub.id.slice(0, 8)}…). Notifications will arrive here.`);
        step('info', 'All good — remove ?push-debug from the URL to hide this panel.');
        return;
      }

      const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (perm === 'denied') {
        step('bad', 'Notifications are BLOCKED for this site in this browser — the prompt can never appear.');
        step('info', 'Fix: click the padlock / tune icon left of the address bar → Site settings → Notifications → Allow, then reload.');
        return;
      }

      step('wait', 'This browser is not subscribed yet. Click the button below to show the permission prompt now.');
      if (listEl) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Show the permission prompt now';
        btn.style.cssText = 'margin-top:6px;padding:6px 10px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:inherit;cursor:pointer;';
        btn.onclick = async () => {
          try {
            await OneSignal.Notifications?.requestPermission?.();
            const now = typeof Notification !== 'undefined' ? Notification.permission : 'unknown';
            step(now === 'granted' ? 'ok' : 'bad', now === 'granted'
              ? 'Permission granted — this browser is now subscribed. Reload with ?push-debug to see the subscription id.'
              : `Permission is still "${now}" — check the padlock → Site settings → Notifications.`);
          } catch (e) {
            step('bad', `requestPermission failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        };
        listEl.appendChild(btn);
      }
    };

    // ---------- pre-init checks ----------
    step('ok', 'OneSignalInit component is mounted in the layout.');

    const httpsOk = window.location.protocol === 'https:'
      || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    step(httpsOk ? 'ok' : 'bad', httpsOk
      ? `Page is served over ${window.location.protocol}// — OK for web push.`
      : `Page is served over ${window.location.protocol} — web push REQUIRES https:// (or localhost).`);

    if (APP_ID) {
      step('ok', `NEXT_PUBLIC_ONESIGNAL_APP_ID is baked into this build (${APP_ID.slice(0, 10)}…).`);
    } else {
      step('bad', 'NEXT_PUBLIC_ONESIGNAL_APP_ID is EMPTY in this build — OneSignal cannot start, so no bell and no prompt.');
      step('info', 'Fix: set it where you BUILD (locally .env.local, on Vercel Project Settings → Environment Variables), then redeploy.');
    }

    // SDK arriving late or never (ad blockers) — watchdog, debug mode only
    const watchdog = window.setTimeout(() => {
      if (debug && !window.OneSignal) {
        step('bad', 'The OneSignal SDK did not arrive within 10 s — an ad blocker or network filter may be blocking cdn.onesignal.com.');
      }
    }, 10000);

    if (window.OneSignal) {
      void initOneSignal(window.OneSignal); // SDK beat this effect (cached) — init directly
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(initOneSignal); // SDK consumes this queue when it loads
    }

    return () => window.clearTimeout(watchdog);
  }, []);

  return <Script src={SDK_SRC} strategy="afterInteractive" />;
}
