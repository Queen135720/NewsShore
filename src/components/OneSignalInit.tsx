'use client';

// ================================================================
// OneSignal web push init — Next.js App Router client component.
//
// 1) Put this file at:  src/components/OneSignalInit.tsx
// 2) Add it ONCE to your root layout (src/app/layout.tsx), inside
//    <body>, next to your other global components:
//
//        import OneSignalInit from '@/components/OneSignalInit';
//        ...
//        <body>
//          <OneSignalInit />
//          ...rest of the app
//
// 3) Add to .env / hosting env vars:
//        NEXT_PUBLIC_ONESIGNAL_APP_ID=your OneSignal App ID
//        SITE_URL=https://your-domain.com
//
// 4) The OneSignalSDKWorker.js file that came with this delivery
//    goes in the `public/` folder, so it is served at
//    https://your-domain.com/OneSignalSDKWorker.js
//
// 5) In the OneSignal dashboard enable the slide prompt:
//    Settings > Push & in-app setup > Web > Permission prompts
//    (Typical Site setup manages prompts from the dashboard.)
//
// FIX (v2): the previous version only queued a callback on
// OneSignalDeferred but never loaded the SDK script, so the queue
// was never consumed, OneSignal never initialized and no browser
// ever showed the permission prompt — zero push subscriptions.
// This version appends the SDK <script> itself. React strict mode
// double-mount is handled (script added only once).
// ================================================================

import { useEffect } from 'react';

export default function OneSignalInit() {
  useEffect(() => {
    // queue our init BEFORE the script loads — the SDK consumes
    // this array as soon as it is ready
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
        notifyButton: { enable: true },
      });
    });

    // load the SDK page script if it is not already on the page
    const SRC = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  return null;
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: { init: (options: Record<string, unknown>) => Promise<void> }) => void>;
  }
}
