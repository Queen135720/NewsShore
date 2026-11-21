// src/app/api/subscribe/route.js
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    return await handleSubscribe(req);
  } catch (err) {
    console.log('[subscribe] CRASH:', err?.message, '\n', err?.stack?.slice(0, 400));
    return NextResponse.json({ error: 'crash', detail: String(err?.message || err) }, { status: 500 });
  }
}

async function handleSubscribe(req) {
  const log = (...args) => console.log('[subscribe]', ...args);

  // ---- 1. Read + validate email ----
  let email = '';
  try {
    const body = await req.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // ---- 2. Supabase config ----
  const sbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    log('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return NextResponse.json({ error: 'server_config' }, { status: 500 });
  }
  const sbHeaders = {
    'Content-Type': 'application/json',
    apikey: sbKey,
    Authorization: `Bearer ${sbKey}`,
  };

  // ---- 3. Duplicate check — existing subscribers never get a second mail ----
  try {
    const check = await fetch(
      `${sbUrl}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=id`,
      { headers: sbHeaders }
    );
    if (check.ok) {
      const rows = await check.json();
      if (Array.isArray(rows) && rows.length > 0) {
        log('already subscribed:', email);
        return NextResponse.json({ already: true });
      }
    }
  } catch (err) {
    log('duplicate check failed (continuing):', err?.message);
  }

  // ---- 4. Save the subscriber ----
  try {
    const insert = await fetch(`${sbUrl}/rest/v1/subscribers`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ email }),
    });
    if (!insert.ok && insert.status !== 409) {
      const t = await insert.text().catch(() => '');
      log('insert failed:', insert.status, t.slice(0, 200));
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
  } catch (err) {
    log('insert error:', err?.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
  log('saved:', email);

  // ---- 5. Welcome mail — best effort ----
  const mailStatus = await sendWelcomeEmail(email, log);

  return NextResponse.json({ ok: true, mailStatus });
}

// ================================================================
async function sendWelcomeEmail(email, log) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'NewsShore';

  if (!apiKey || !senderEmail) {
    const missing = [!apiKey && 'BREVO_API_KEY', !senderEmail && 'BREVO_SENDER_EMAIL'].filter(Boolean).join(' + ');
    log(`MAIL SKIPPED — ${missing} not visible to the site. Add them where SUPABASE_SERVICE_ROLE_KEY lives, then REDEPLOY.`);
    return `skipped-env-missing (${missing})`;
  }

  const html = `
<div style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0f1b3d;padding:28px 32px;">
          <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">NewsShore</span>
        </td></tr>
        <tr><td style="padding:32px 32px 8px 32px;">
          <h1 style="margin:0 0 16px 0;font-size:20px;color:#0f1b3d;">Thank you for subscribing to NewsShore</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#333333;">Hi there,</p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#333333;">
            Welcome to NewsShore — and thank you for subscribing.
          </p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#333333;">
            We started NewsShore because AI is no longer just a "tech people" topic. It's reshaping jobs, business,
            education, and everyday life — which means everyone deserves to understand what's happening, not just
            engineers and developers.
          </p>
          <p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#333333;">Here's what you can expect from us:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:22px;color:#333333;">
            <tr><td style="padding:6px 0;"><b>Global Coverage</b><br>We track AI and tech developments across every major market — from Silicon Valley to Shenzhen, London to Lagos. No region gets left out of the story.</td></tr>
            <tr><td style="padding:6px 0;"><b>Reliability Tags</b><br>Every article is clearly labeled "Independently verified" or "Company claim," so you always know how much to trust what you're reading. We go beyond press releases — checking independent sources, public filings, and expert analysis.</td></tr>
            <tr><td style="padding:6px 0;"><b>Glossary Boxes</b><br>See a confusing term like "LLM" or "fine-tuning"? Our "Understand This Story" glossary breaks down the jargon in plain language, right inside the article.</td></tr>
            <tr><td style="padding:6px 0;"><b>Related Stories</b><br>Explore more on any topic using in-page tabs — no need to leave the article you're reading.</td></tr>
            <tr><td style="padding:6px 0;"><b>AI Model Intelligence Leaderboard</b><br>Curious which AI models are actually the best? Our leaderboard ranks 300+ models using the LLM Stats Score, updated daily.</td></tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:15px;line-height:22px;color:#333333;">
            You're on the list. From now on, the tech stories that actually matter will land in your inbox — clear, concise, and free of noise.
          </p>
          <p style="margin:16px 0 0 0;font-size:15px;line-height:22px;color:#333333;">
            We're glad you're here. Welcome aboard — let's stay informed, together.<br><b>The NewsShore Team</b>
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #eeeeee;">
          <p style="margin:0 0 12px 0;font-size:15px;font-weight:bold;color:#0f1b3d;">Join Our Socials</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 8px 8px 0;">
                <a href="https://t.me/News_Shore" style="display:inline-block;background:#0f1b3d;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 18px;border-radius:6px;">Telegram</a>
              </td>
              <td style="padding:0 8px 8px 0;">
                <a href="https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 18px;border-radius:6px;">WhatsApp</a>
              </td>
              <td style="padding:0 0 8px 0;">
                <a href="https://web.facebook.com/profile.php?id=61592735245077" style="display:inline-block;background:#1877F2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 18px;border-radius:6px;">Facebook</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;">
          <p style="margin:0;font-size:12px;line-height:18px;color:#888888;">
            You're receiving this email because you subscribed at newsshore.com.
            If this wasn't you, you can ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;

  const text = `Thank you for subscribing to NewsShore!

Hi there,

Welcome to NewsShore — and thank you for subscribing.

We started NewsShore because AI is no longer just a "tech people" topic. It's reshaping jobs, business, education, and everyday life — which means everyone deserves to understand what's happening, not just engineers and developers.

Here's what you can expect from us:

GLOBAL COVERAGE
We track AI and tech developments across every major market — from Silicon Valley to Shenzhen, London to Lagos. No region gets left out of the story.

RELIABILITY TAGS
Every article is clearly labeled "Independently verified" or "Company claim," so you always know how much to trust what you're reading. We go beyond press releases — checking independent sources, public filings, and expert analysis.

GLOSSARY BOXES
See a confusing term like "LLM" or "fine-tuning"? Our "Understand This Story" glossary breaks down the jargon in plain language, right inside the article.

RELATED STORIES
Explore more on any topic using in-page tabs — no need to leave the article you're reading.

AI MODEL INTELLIGENCE LEADERBOARD
Curious which AI models are actually the best? Our leaderboard ranks 300+ models using the LLM Stats Score, updated daily.

You're on the list. From now on, the tech stories that actually matter will land in your inbox — clear, concise, and free of noise.

Join Our Socials:
Telegram: https://t.me/News_Shore
WhatsApp: https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32
Facebook: https://web.facebook.com/profile.php?id=61592735245077

We're glad you're here. Welcome aboard — let's stay informed, together.

The NewsShore Team`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email }],
        subject: 'Welcome to NewsShore',
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const body = await res.text().catch(() => '');
    if (res.ok) {
      log('welcome mail sent to', email);
      return 'sent';
    }
    log(`MAIL FAILED — HTTP ${res.status}: ${body.slice(0, 300)}`);
    return `error-${res.status}`;
  } catch (err) {
    log('MAIL FAILED —', err?.message);
    return 'error-network';
  }
}
