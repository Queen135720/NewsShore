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
// ================================================================

import { useEffect } from 'react';

export default function OneSignalInit() {
  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      await OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
        notifyButton: { enable: true },
      });
    });
  }, []);

  return null;
}
