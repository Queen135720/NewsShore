// NewsShore subscribe: saves email to Supabase + sends Brevo welcome mail.
// Even if the mail fails, the subscriber is saved — signup never errors for the user.

const WELCOME_SUBJECT = 'Welcome to NewsShore — AI & Tech news, made for everyone';

const WELCOME_TEXT = `Hi there,

Welcome to NewsShore — and thank you for subscribing.

We started NewsShore because AI is no longer just a "tech people" topic. It's reshaping jobs, business, education, and everyday life — which means everyone deserves to understand what's happening, not just engineers and developers.

Here's what you can expect from us:

🌍 Global Coverage
We track AI and tech developments across every major market — from Silicon Valley to Shenzhen, London to Lagos. No region gets left out of the story.

✅ Reliability Tags
Every article is clearly labeled "Independently verified" or "Company claim," so you always know how much to trust what you're reading. We go beyond press releases — checking independent sources, public filings, and expert analysis.

📖 Glossary Boxes
See a confusing term like "LLM" or "fine-tuning"? Our "Understand This Story" glossary breaks down the jargon in plain language, right inside the article.

🔗 Related Stories
Explore more on any topic using in-page tabs — no need to leave the article you're reading.

📊 AI Model Intelligence Leaderboard
Curious which AI models are actually the best? Our leaderboard ranks 300+ models using the LLM Stats Score, updated daily.

Stay connected with us beyond your inbox:
Telegram: https://t.me/News_Shore
WhatsApp: https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32
Facebook: https://web.facebook.com/profile.php?id=61592735245077

We're glad you're here. Welcome aboard — let's stay informed, together.

The NewsShore Team`;

const WELCOME_HTML = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background-color:#0f1b3d;padding:28px 32px;text-align:center;">
    <span style="color:#ffffff;font-size:26px;font-weight:bold;letter-spacing:1px;">NewsShore</span><br>
    <span style="color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">AI &amp; Tech news, made for everyone</span>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi there,</p>
    <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">Welcome to <strong>NewsShore</strong> &mdash; and thank you for subscribing.</p>
    <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">We started NewsShore because AI is no longer just a &ldquo;tech people&rdquo; topic. It&rsquo;s reshaping jobs, business, education, and everyday life &mdash; which means everyone deserves to understand what&rsquo;s happening, not just engineers and developers.</p>
    <p style="margin:0 0 16px;font-size:16px;color:#111827;line-height:1.6;">Every day, we track the stories that matter across the technology world and bring them to you in plain, clear language &mdash; no jargon, no noise.</p>
    <p style="margin:0 0 10px;font-size:15px;color:#111827;"><strong>What we cover:</strong></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr><td style="padding:4px 0;font-size:15px;color:#374151;"><span style="color:#dc2626;">&bull;</span>&nbsp; Artificial intelligence and machine learning</td></tr>
      <tr><td style="padding:4px 0;font-size:15px;color:#374151;"><span style="color:#dc2626;">&bull;</span>&nbsp; Tech giants &mdash; OpenAI, Google, Microsoft, Nvidia, Meta and more</td></tr>
      <tr><td style="padding:4px 0;font-size:15px;color:#374151;"><span style="color:#dc2626;">&bull;</span>&nbsp; Startups, funding rounds and acquisitions</td></tr>
      <tr><td style="padding:4px 0;font-size:15px;color:#374151;"><span style="color:#dc2626;">&bull;</span>&nbsp; New research and breakthroughs</td></tr>
      <tr><td style="padding:4px 0;font-size:15px;color:#374151;"><span style="color:#dc2626;">&bull;</span>&nbsp; Deals and global tech markets</td></tr>
    </table>
    <p style="margin:0;font-size:16px;color:#111827;line-height:1.6;">That&rsquo;s it &mdash; you&rsquo;re all set. The next time something big happens in tech, you&rsquo;ll be among the first to know.</p>
  </td></tr>
  <tr><td style="background-color:#f8fafc;border-top:1px solid #e5e7eb;padding:28px 32px;text-align:center;">
    <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:#0f1b3d;letter-spacing:2px;text-transform:uppercase;">Join Our Socials</p>
    <a href="https://t.me/News_Shore" style="display:inline-block;margin:4px;padding:11px 22px;background-color:#0f1b3d;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;border-radius:24px;">Telegram</a>
    <a href="https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32" style="display:inline-block;margin:4px;padding:11px 22px;background-color:#25D366;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;border-radius:24px;">WhatsApp</a>
    <a href="https://web.facebook.com/profile.php?id=61592735245077" style="display:inline-block;margin:4px;padding:11px 22px;background-color:#1877F2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;border-radius:24px;">Facebook</a>
  </td></tr>
  <tr><td style="padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">You received this email because you subscribed at NewsShore.<br>&copy; 2026 NewsShore. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'invalid email' }, { status: 400 });
    }

    const sbUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) {
      console.error('[subscribe] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars on host');
      return Response.json({ error: 'server config' }, { status: 500 });
    }
    const sbHeaders = {
      'apikey': sbKey,
      'Authorization': 'Bearer ' + sbKey,
      'Content-Type': 'application/json',
    };

    // 1. Already subscribed? -> friendly notice, no second mail
    const check = await fetch(`${sbUrl}/rest/v1/subscribers?select=email&email=eq.${encodeURIComponent(email)}`, { headers: sbHeaders });
    if (!check.ok) {
      console.error(`[subscribe] Supabase check failed ${check.status}: ${(await check.text()).slice(0, 200)}`);
      return Response.json({ error: 'database' }, { status: 500 });
    }
    if ((await check.json()).length > 0) {
      return Response.json({ already: true });
    }

    // 2. Save the subscriber
    const insert = await fetch(`${sbUrl}/rest/v1/subscribers`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ email }),
    });
    if (!insert.ok) {
      console.error(`[subscribe] Supabase insert failed ${insert.status}: ${(await insert.text()).slice(0, 200)}`);
      return Response.json({ error: 'database' }, { status: 500 });
    }

    // 3. Send the welcome mail (non-fatal: subscriber is already saved)
    const mailErr = await sendWelcomeEmail(email);
    if (mailErr) console.error('[subscribe] Welcome mail not sent (subscriber saved):', mailErr);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[subscribe] crashed:', e);
    return Response.json({ error: 'server' }, { status: 500 });
  }
}

async function sendWelcomeEmail(email) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return 'BREVO_API_KEY / BREVO_SENDER_EMAIL env vars not set on host';

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'NewsShore', email: senderEmail },
        to: [{ email }],
        subject: WELCOME_SUBJECT,
        htmlContent: WELCOME_HTML,
        textContent: WELCOME_TEXT,
      }),
    });
    if (!res.ok) return `Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`;
    return null;
  } catch (e) {
    return String(e.message || e);
  }
}
