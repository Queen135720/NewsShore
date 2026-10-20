// NewsShore automation pipeline
// 1) checks RSS feeds for new articles
// 2) rewrites with AI (Gemini → GLM → Groq → DeepSeek fallback chain)
// 3) saves to Supabase for the website to display
//
// Image system:
//   - AI generates visual search queries during the rewrite (no brand names)
//   - Unsplash searched with quality floor + no repeats (dedup vs last 300 articles)
//   - never falls back to source-article images (that was the Alamy watermark leak)

import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';

const providerDown = { gemini: false, glm: false, groq: false, groq20b: false, mistral: false, nvidia: false, nvidia2: false, deepseek: false };

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'NewsShore-Bot/1.0 (https://newsshore.com)',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  },
  customFields: {
    item: ['media:content', 'media:thumbnail'],
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ---- 1. SOURCES ----
const SOURCES = [
  // ---- AI News ----
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Google DeepMind', url: 'https://research.google/blog/rss/', category: 'AI News', region: 'US' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', category: 'AI News', region: 'Global' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI News', region: 'Global' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'AI News', region: 'US' },

  // ---- Tech Giants (tech leaders as people) ----
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', category: 'Tech Giants', region: 'Global' },
  { name: 'Ethan Mollick', url: 'https://www.oneusefulthing.org/feed', category: 'Tech Giants', region: 'US' }, // ⚠ verify
  { name: 'Andrej Karpathy', url: 'https://karpathy.github.io/feed.xml', category: 'Tech Giants', region: 'US' }, // ⚠ verify — posts rarely
  
  // ---- Tech News (general + robotics) ----
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech News', region: 'Global' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech News', region: 'Global' },
  { name: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/', category: 'Tech News', region: 'US' }, // ⚠ verify — kept (was mislabeled "Robotics"; it's their AI feed — the LLM will file these as AI News)
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'Tech News', region: 'Global' },
  { name: 'CNET', url: 'https://www.cnet.com/rss/news/', category: 'Tech News', region: 'Global' },
  { name: 'TechCrunch Robotics', url: 'https://techcrunch.com/category/robotics/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechCrunch Space', url: 'https://techcrunch.com/category/space/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechCrunch Security', url: 'https://techcrunch.com/category/security/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechCrunch Hardware', url: 'https://techcrunch.com/category/hardware/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechCrunch Gadgets', url: 'https://techcrunch.com/category/gadgets/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechCrunch Europe', url: 'https://techcrunch.com/tag/europe/feed/', category: 'Tech News', region: 'Europe' },
  { name: 'TechCrunch Asia', url: 'https://techcrunch.com/tag/asia/feed/', category: 'Tech News', region: 'Asia' },
  { name: 'The Robot Report', url: 'https://www.therobotreport.com/feed/', category: 'Tech News', region: 'Global' },
  { name: 'IEEE Spectrum Robotics', url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', category: 'Tech News', region: 'Global' }, // ⚠ verify
  { name: 'Robotics Business Review', url: 'https://www.roboticsbusinessreview.com/feed/', category: 'Tech News', region: 'Global' }, // ⚠ verify

  // ---- Mobile & Social ----
  { name: 'Apple Insider', url: 'https://appleinsider.com/rss/news/', category: 'Mobile & Social', region: 'Global' },
  { name: '9to5Mac', url: 'https://9to5mac.com/feed/', category: 'Mobile & Social', region: 'US' },
  { name: '9to5Google', url: 'https://9to5google.com/feed/', category: 'Mobile & Social', region: 'US' },
  { name: 'Android Authority', url: 'https://www.androidauthority.com/feed/', category: 'Mobile & Social', region: 'US' },
  { name: 'Android Police', url: 'https://www.androidpolice.com/feed/', category: 'Mobile & Social', region: 'US' },
  { name: 'TechCrunch Apps', url: 'https://techcrunch.com/category/apps/feed/', category: 'Mobile & Social', region: 'Global' },
  { name: 'TechCrunch Social', url: 'https://techcrunch.com/category/social/feed/', category: 'Mobile & Social', region: 'Global' },
  { name: 'TechCrunch Mobile', url: 'https://techcrunch.com/tag/mobile/feed/', category: 'Mobile & Social', region: 'Global' },
  { name: 'TechCrunch Media & Entertainment', url: 'https://techcrunch.com/category/media-entertainment/feed/', category: 'Mobile & Social', region: 'Global' },
  { name: 'Social Media Examiner', url: 'https://www.socialmediaexaminer.com/feed/', category: 'Mobile & Social', region: 'Global' },

  // ---- Startups & Funding ----
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'TechCrunch Funding', url: 'https://techcrunch.com/tag/funding/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'TechCrunch Venture', url: 'https://techcrunch.com/category/venture/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'TechCrunch Enterprise', url: 'https://techcrunch.com/category/enterprise/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'TechCrunch Fintech', url: 'https://techcrunch.com/category/fintech/feed/', category: 'Startups & Funding', region: 'Global' },

  // ---- Deals ----
  { name: 'TechCrunch Deals', url: 'https://techcrunch.com/tag/deals/feed/', category: 'Deals', region: 'Global' }, // ⚠ verify — your Deals nav category had zero sources without this

  // ---- Research (AI + quantum + science) ----
  { name: 'MIT News AI', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', category: 'Research', region: 'US' },
  { name: 'Nature Tech', url: 'https://www.nature.com/subjects/technology.rss', category: 'Research', region: 'Global' },
  { name: 'Quantum Computing Report', url: 'https://quantumcomputingreport.com/news/feed/', category: 'Research', region: 'Global' },
  { name: 'Inside Quantum Technology', url: 'https://insidequantumtechnology.com/feed/', category: 'Research', region: 'Global' }, // ⚠ verify

  // ---- Global Tech (country-specific) ----
  { name: 'Rest of World', url: 'https://restofworld.org/feed/latest/', category: 'Global Tech', region: 'Global' },
  { name: 'TechCabal', url: 'https://techcabal.com/feed/', category: 'Global Tech', region: 'Nigeria' },
  { name: 'Nairametrics Tech', url: 'https://nairametrics.com/feed/', category: 'Global Tech', region: 'Nigeria' },
  { name: 'TechCentral ZA', url: 'https://techcentral.co.za/feed/', category: 'Global Tech', region: 'South Africa' },
  { name: 'e27', url: 'https://e27.co/feed/', category: 'Global Tech', region: 'Singapore' },
  { name: 'TechNode', url: 'https://technode.com/feed/', category: 'Global Tech', region: 'China' },
  { name: 'Nocamels', url: 'https://nocamels.com/feed/', category: 'Global Tech', region: 'Israel' },
];

// ---- 2. FETCH NEW ITEMS ----
async function fetchNewItems() {
  // Load ALL existing article URLs in ONE query
  const { data: existingRows } = await supabase
    .from('articles')
    .select('source_url');
  const existingUrls = new Set((existingRows ?? []).map((r) => r.source_url));

  // Load processed URLs: rejections are permanent, failures retry after 24 hours
  const { data: processedRows } = await supabase
    .from('processed_urls')
    .select('source_url, status, created_at');
  const processedUrls = new Set(
    (processedRows ?? [])
      .filter((r) => r.status === 'rejected' || new Date(r.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .map((r) => r.source_url)
  );

  const allItems = [];
  const seenThisRun = new Set();

  for (const source of SOURCES) {
    for (const page of [1, 2]) {
      try {
        const url =
          page === 1
            ? source.url
            : `${source.url}${source.url.includes('?') ? '&' : '?'}paged=${page}`;
        const feed = await parser.parseURL(url);
        const items = feed.items ?? [];

        for (const item of items) {
          if (!item.link || seenThisRun.has(item.link)) continue;
          if (existingUrls.has(item.link)) continue; // already saved
          if (processedUrls.has(item.link)) continue; // rejected, or failed recently

          // Skip old items — only ingest news from the last 10 days
          const itemDate = item.isoDate ? new Date(item.isoDate).getTime() : 0;
          if (itemDate && Date.now() - itemDate > 10 * 24 * 60 * 60 * 1000) continue;

          // Skip promos, roundups, and non-news filler
          const t = (item.title || '').toLowerCase();
          if (/wallpaper|giveaway|contest|save on your pass|discount code|cyber monday|black friday|newsletter|podcast episode|techcrunch disrupt|GTA|grand theft|switch 2|xbox|playstation|nintendo|witcher|steam deck|epic games|fortnite|valorant|gaming|game pad|gamepad|controller review|8bitdo|directv|multiview|smart TV|apple tv|google tv|home speakers|smart speaker|soundbar|home theater|home theatre|bluetooth speaker|wireless speaker|speaker (review|launch|deal)|sony.*(microphone|speaker)|repair cost|repairability comparison/i.test(t)) continue;

          seenThisRun.add(item.link);
          allItems.push({ ...item, sourceName: source.name, category: source.category, region: source.region });
        }

        if (items.length < 10) break; // short feed — no page 2 exists
      } catch (err) {
        console.error(`Failed to fetch ${source.name} (page ${page}): ${err.message?.substring(0, 100)}`);
        break; // if page 1 fails, skip page 2
      }
    }
  }

  // Newest first across all sources
  allItems.sort((a, b) => new Date(b.isoDate ?? 0).getTime() - new Date(a.isoDate ?? 0).getTime());

  return allItems;
}
// ---- 3. REWRITE WITH AI ----
async function rewriteArticle(item) {
  // Truncate source content — keeps every provider under its token limits
  const rawContent = item.contentSnippet || item.content || '';
  const sourceContent = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);

  const prompt = `You are a neutral tech news writer for a general, non-technical global audience.

RELEVANCE CHECK — do this first:
Decide if the story is GENUINELY tech news. It must be primarily about technology, AI, software, hardware, gadgets, internet, robotics, science, space, quantum computing, cyber security, startups, or the tech industry itself.
Reject ALL of these even if a tech company or tech person is mentioned:
- Business, finance, pension funds, stock markets, IPOs, oil, banking (unless it is fintech or crypto technology)
- Politics, government policy, legal disputes, court cases (unless the case is specifically about tech regulation or tech companies)
- Labor disputes, strikes, HR matters, executive suspension or leave
- Sports, entertainment, celebrity news, lifestyle
- Deals/discounts/sales on products (price drops, coupon codes, shopping events like Prime Day, "all-time low price")
- Events, conferences, ticket sales, promotional content
- Gaming content: video game releases, game, classic games, game release dates/rumors, game console/PC gaming coverage, gaming controller and accessory reviews (e.g., "coming to PC", Switch/PlayStation/Xbox game news, gaming peripheral reviews)
- Audio accessory minutiae: earbud/headphone firmware updates, minor accessory refreshes
- Phone Accessories: USB Cord, Speakers, Home Speakers, Home theater- Audio hardware: speakers, soundbars, home theater, microphones, headphones beyond major flagship launches
- TV and streaming platform features (smart tv, apple tv, multiview, channel guides, streaming apps on TVs)
- Company PR statements about ongoing business relationships (e.g., "CEO says contracts continue")
- Repair cost comparisons between devices
- Individual HR matters (one executive suspended, one person fired, internal disputes)
- Court cases are tech news ONLY when they directly concern a tech company's products, data practices, or AI technology (e.g., states suing OpenAI over children's data = keep as AI News; a parking dispute involving a tech CEO = reject)
- Product price announcements and discount posts (including "now available to preorder at $X" when the story is about the price, not the product)
If the tech angle is not the CENTRAL subject of the story, respond ONLY with:
{"reject": true, "reason": "one short sentence"}

If the story passes the relevance check, rewrite it into:
1. A clear headline (under 12 words)
2. A 2-3 sentence summary that captures the key points
3. A 500-1000 word article body, fully in your own words but accurate and verifiable. Do not copy phrases from the original.
4. A "reliability" tag: "verified" if from independent testing/reporting, or "claimed" if it's a company announcement
5. Three to ten short glossary terms (technical word + one-sentence plain-language explanation)
6. A "category" — exactly one of: "AI News", "Mobile & Social", "Tech News", "Tech Giants", "Startups & Funding", "Research", "Deals", "Global Tech"
7. A "region" — where the story is about, in one or two words (examples: "Nigeria", "South Africa", "Singapore", "Japan", "Israel", "China", "US", "Europe", "Global"). Judge from the story content, not the source.
8. Three stock-photo search queries (2-4 words each) to illustrate this story. Rules: describe things you can SEE — objects, machines, places, people (e.g. "data center aisle", "robot arm factory", "circuit board macro"). NEVER use company or brand names — describe the product or industry instead (e.g. for a Nvidia chip story use "computer chip closeup"). Never abstract words alone like "future" or "innovation".

CATEGORY RULES:
- "AI News" — artificial intelligence: models, AI companies, AI research, AI applications, AI policy
- "Mobile & Social" — smartphones, phone hardware, phone reviews, apps, app stores, social media platforms and their features
- "Tech Giants" — tech industry LEADERS as people: their statements, essays, predictions, career moves, controversies. ONLY when the story is ABOUT the person. If a CEO simply commented on policy, that is not Tech Giants — reject it unless the statement is about technology itself
- "Tech News" — general technology: laptops, gadgets, robotics, hardware, cyber security, space tech, tech company product launches
- "Startups & Funding" — startup launches, funding rounds, venture capital, accelerators, startup ecosystem
- "Research" — scientific research, AI research papers, quantum computing research, biotech, lab breakthroughs
- "Deals" — mergers, acquisitions, major corporate partnerships between tech companies
- "Global Tech" — stories primarily about one country's or region's tech scene, ecosystem, or tech policy. The country's tech scene must be the subject — not general news that merely happened in that country
When unsure between two categories, choose the one a reader would most expect the story to appear under on a tech news site.
- Gadget accessory reviews (cables, chargers, controllers, earbuds) are NOT tech news — reject them unless the accessory represents a genuinely new technology.
- A story about a company raising money (funding rounds, IPOs, valuations) is "Startups & Funding". A story about a product's price dropping or a sale event is NOT news — reject it.

IMPORTANT RULES:
- Do not begin a Summary with "This article".
- Do not invent quotes, sources, statistics, or links.
- Do not fabricate any information not present in the source text.
- If you don't know something, leave it out rather than guessing.
- Format the body in simple markdown only: use "## Subheading" for section headings, "- item" for bullet lists, and **bold** for emphasis. Never use tables, code blocks, or # symbols for anything else.
- Do not add disclaimers, notes about verification, or meta-commentary about the source. Just report what the source says.

Respond ONLY in this exact JSON format, nothing else:
{"headline": "...", "summary": "...", "body": "...", "reliability": "...", "category": "...", "region": "...", "glossary": [{"term":"...","definition":"..."}], "imageQueries": ["...", "...", "..."]}

Source title: ${item.title}
Source site: ${item.sourceName} (suggested category: "${item.category}", suggested region: "${item.region}" — override these if the story content says otherwise)
Source content: ${sourceContent}`;

    // All providers already down this run → fail fast, don't hammer
  if (providerDown.gemini && providerDown.glm && providerDown.groq && providerDown.groq20b && providerDown.mistral && providerDown.nvidia && providerDown.nvidia2) {
    throw new Error('All providers throttled — pausing this run');
  }

  if (!providerDown.glm) {
    try { return await callGLM(prompt); }
    catch (err) {
      if (/429|timeout|abort/i.test(err.message)) { providerDown.glm = true; console.warn('GLM throttled/hung — skipping rest of this run'); }
      else console.warn(`GLM failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.nvidia) {
    try { return await callNvidia(prompt); }
    catch (err) {
      if (/429|rate|404|410|not found|end of life/i.test(err.message)) { providerDown.nvidia = true; console.warn('NVIDIA GLM throttled — skipping rest of this run'); }
      else console.warn(`NVIDIA failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.nvidia2) {
    try { return await callNvidia2(prompt); }
    catch (err) {
      if (/429|rate|404|410|not found|end of life/i.test(err.message)) { providerDown.nvidia2 = true; console.warn('NVIDIA Llama throttled — skipping rest of this run'); }
      else console.warn(`NVIDIA2 failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.groq) {
    try { return await callGroq(prompt); }
    catch (err) {
      if (/429|rate|unavailable for free|403/i.test(err.message)) { providerDown.groq = true; console.warn('Groq throttled — skipping rest of this run'); }
      else console.warn(`Groq failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.groq20b) {
    try { return await callGroq20B(prompt); }
    catch (err) {
      if (/429|413/i.test(err.message)) { providerDown.groq20b = true; console.warn('Groq20B throttled — skipping rest of this run'); }
      else console.warn(`Groq20B failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.mistral) {
    try { return await callMistral(prompt); }
    catch (err) {
      if (/429|rate|unavailable for free|403/i.test(err.message)) { providerDown.mistral = true; console.warn('Mistral throttled — skipping rest of this run'); }
      else console.warn(`Mistral failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.gemini) {
    try { return await callGemini(prompt); }
    catch (err) {
      if (/429|rate|unavailable for free|403/i.test(err.message)) { providerDown.gemini = true; console.warn('Gemini quota dead — skipping rest of this run'); }
      else console.warn(`Gemini failed, falling back: ${err.message}`);
    }
  }
  if (!providerDown.deepseek) {
    try { return await callDeepSeek(prompt); }
    catch (err) {
      if (/429|rate|unavailable for free|403/i.test(err.message)) { providerDown.deepseek = true; console.warn('DeepSeek balance empty — skipping rest of this run'); }
      else console.warn(`DeepSeek failed: ${err.message}`);
    }
  }
  throw new Error('All 6 AI providers failed');
}

async function retryFetch(url, options) {
  let res = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2500));
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
  }
  return res;
}

function safeParseJSON(text) {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) { /* continue */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in response');
  let jsonStr = cleaned.substring(start, end + 1);
  try { return JSON.parse(jsonStr); } catch (e) { /* continue */ }
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === '\\') { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      result += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t';
      continue;
    }
    result += ch;
  }
  try { return JSON.parse(result); } catch (e) { throw new Error('Failed to parse AI JSON'); }
}

async function callGLM(prompt) {
  if (!process.env.GLM_API_KEY) throw new Error('GLM_API_KEY not set');
  const res = await retryFetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GLM_API_KEY}` },
    body: JSON.stringify({ model: 'glm-4.5-flash', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GLM error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
}

async function callNvidia(prompt) {
  if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY not set');
  const res = await retryFetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.3',  // ← slot 1: your pick
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`NVIDIA error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('NVIDIA returned an empty response');
  return safeParseJSON(content);
}

async function callNvidia2(prompt) {
  if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY not set');
  const res = await retryFetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-ai/deepseek-v4.1-flash',   // ← slot 2: a different model family for diversity
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`NVIDIA2 error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('NVIDIA2 returned an empty response');
  return safeParseJSON(content);
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await retryFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
}

async function callGroq20B(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await retryFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq20B error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq20B returned an empty response');
  return safeParseJSON(content);
}

async function callMistral(prompt) {
  if (!process.env.MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY not set');
  const res = await retryFetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, // forces valid JSON — much more reliable
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Mistral error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const res = await retryFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  return safeParseJSON(text); // ★ was a double-return with dead code — fixed
}

async function callDeepSeek(prompt) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');
  const res = await retryFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`DeepSeek error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
}

// ---- 4. FETCH IMAGE FROM UNSPLASH ----
// ★ Completely rebuilt. Never uses the headline directly, never repeats an image,
// never falls back to source-article images (that was the Alamy watermark leak).

const CATEGORY_IMAGE_TERMS = {
  'AI News': ['neural network visualization', 'artificial intelligence abstract', 'robot technology'],
  'Tech Giants': ['server room', 'data center', 'modern tech office'],
  'Tech News': ['circuit board macro', 'computer chip closeup', 'gpu graphics card'],
  'Startups & Funding': ['startup team meeting', 'modern workspace', 'business handshake'],
  'Research': ['research laboratory', 'scientist at computer', 'data analysis screen'],
  'Deals': ['stock market screen', 'finance charts', 'business deal'],
  'Global & China': ['asia city skyline night', 'global network map', 'shanghai skyline'],
  'Latest': ['abstract technology blue', 'futuristic screen', 'circuit board'],
};

function imageKey(url) {
  const m = (url || '').match(/photo-([\w-]+)/);
  return m ? m[1] : url;
}

// ---- Source image extraction: use the publisher's own photo when it's clean ----
const BANNED_IMAGE_HOSTS = /(alamy|shutterstock|gettyimages|istockphoto|dreamstime|123rf|depositphotos|stock\.adobe)/i;

function extractSourceImage(item) {
  const candidates = [];

  // 1. media:content — where TechCrunch/WIRED/Verge put their hero image
  const mc = item['media:content'];
  if (mc) {
    for (const m of (Array.isArray(mc) ? mc : [mc])) {
      if (m?.url && (!m.type || m.type.startsWith('image/'))) {
        candidates.push({ url: m.url, width: parseInt(m.width || 0, 10) });
      }
    }
  }

  // 2. media:thumbnail
  if (item['media:thumbnail']?.url) {
    candidates.push({ url: item['media:thumbnail'].url, width: parseInt(item['media:thumbnail'].width || 0, 10) });
  }

  // 3. enclosure
  if (item.enclosure?.url && (item.enclosure.type || '').startsWith('image/')) {
    candidates.push({ url: item.enclosure.url, width: 0 });
  }

  // 4. first <img> in the content HTML
  const imgMatch = (item.content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) candidates.push({ url: imgMatch[1], width: 0 });

  // Validate: biggest first; reject stock hosts, non-images, tiny, logos
  for (const c of candidates.sort((a, b) => b.width - a.width)) {
    const u = c.url || '';
    if (!/^https?:\/\//.test(u)) continue;
    if (BANNED_IMAGE_HOSTS.test(u)) continue;
    if (/\.(svg|gif)(\?|$)/i.test(u)) continue;
    if (c.width && c.width < 400) continue;
    if (/logo|icon|avatar|tracking|analytics|1x1|spacer/i.test(u)) continue;
    return c.url;
  }
  return null;
}

// Seed dedup with the last 300 images used in articles
async function loadUsedImageKeys() {
  const { data } = await supabase
    .from('articles')
    .select('image_url')
    .order('created_at', { ascending: false })
    .limit(300);
  return new Set((data ?? []).map((r) => imageKey(r.image_url)).filter(Boolean));
}

async function searchUnsplash(query, usedKeys) {
  const url =
    'https://api.unsplash.com/search/photos?query=' +
    encodeURIComponent(query) +
    '&per_page=30&orientation=landscape&content_filter=high';
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  });
  if (!res.ok) return [];
  const { results = [] } = await res.json();
  return results
    .filter((r) => !r.premium)
    .filter((r) => r.width >= 1600 && r.height >= 900)
    .filter((r) => !usedKeys.has(imageKey(r.urls.raw)))
    .map((r) => ({
      url: `${r.urls.raw}&w=1600&q=80&fm=jpg`,
      key: imageKey(r.urls.raw),
      creditName: r.user?.name ?? 'Unsplash photographer',
      creditUrl: r.user?.links?.html ?? 'https://unsplash.com',
    }));
}

// ---- Fuzzy duplicate detection: same story → same meaningful-word signature ----
const STOP_WORDS = new Set(['the','a','an','of','for','and','or','to','in','on','with','new','its','is','are','as','at','by','from','this','that','unveils','rolls','out','launches','announces','reveals','partners','gets','says','will']);

function fingerprint(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)].sort();
}

// Words that signal a DIFFERENT story about the same product — never a duplicate
const DIFFERENTIATORS = /\b(update|updates|delay|delays|cancel|cancelled|recall|patch|fix|fixes|review|rumor|rumour|versus|discount|lawsuit|sues|probe)\b/i;

function isLikelyDuplicate(titleA, titleB) {
  if (DIFFERENTIATORS.test(titleA) || DIFFERENTIATORS.test(titleB)) return false;

  // Extract proper-noun phrases (capitalized word pairs like "Fitbit Air", "Z Fold")
  const properNouns = (t) => {
    const matches = (t.match(/\b[A-Z][a-z0-9]+(?:\s+[A-Z0-9][a-z0-9]+)*/g) ?? []);
    return [...new Set(matches.filter((p) => p.length > 3))];
  };
  const pnA = properNouns(titleA);
  const pnB = properNouns(titleB);

  // Two matching proper-noun phrases ≥ 10 chars total = same subject ("Fitbit Air" + "Apple Watch")
  if (pnA.length >= 1 && pnB.length >= 1) {
    const shared = pnA.filter((p) => pnB.some((q) => q.toLowerCase() === q && p.toLowerCase() === q.toLowerCase() && p.length >= 4));
    // require the shared phrase to be meaningful (≥ 8 chars, e.g. "Fitbit Air" = 10)
    const meaningfulShared = shared.filter((p) => p.replace(/\s/g, '').length >= 8);
    if (meaningfulShared.length >= 1) return true;
  }

  // Original word-overlap check (still active for titles without clear proper nouns)
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const a = [...new Set(words(titleA))].sort();
  const b = [...new Set(words(titleB))].sort();
  if (!a.length || !b.length) return false;
  if (a.length < 3 || b.length < 3) return a.join(' ') === b.join(' ');
  const sharedWords = a.filter((w) => b.includes(w)).length;
  return sharedWords / Math.max(a.length, b.length) >= 0.6;
}

async function fetchImage(rewritten, category, usedKeys) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;

  const aiQueries = (rewritten.imageQueries ?? [])
    .map((q) => String(q).trim().toLowerCase())
    .filter((q) => q.length > 2 && q.length < 40);

  const fallbacks = CATEGORY_IMAGE_TERMS[category] ?? CATEGORY_IMAGE_TERMS['Latest'];

  for (const query of [...aiQueries, ...fallbacks]) {
    const candidates = await searchUnsplash(query, usedKeys);
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * Math.min(12, candidates.length))];
      usedKeys.add(pick.key);
      return { url: pick.url, creditName: pick.creditName, creditUrl: pick.creditUrl };
    }
  }
  return null;
}

async function saveArticle(item, rewritten, usedKeys) {
  // Guard: skip empty/broken rewrites
  if (!rewritten?.headline?.trim() || !rewritten?.body?.trim() || !rewritten?.summary?.trim()) {
    console.log('Skipping empty article:', item.title ?? item.link);
    return false;
  }

  // Category/region: trust the LLM's read of the story, fall back to the source's values
  const VALID_CATEGORIES = ['AI News', 'Mobile & Social', 'Tech News', 'Tech Giants', 'Startups & Funding', 'Research', 'Deals', 'Global Tech'];
  const category = VALID_CATEGORIES.includes(rewritten.category) ? rewritten.category : item.category;
  const region = (typeof rewritten.region === 'string' && rewritten.region.trim().length > 0) ? rewritten.region.trim() : item.region;

  // Fuzzy duplicate check: skip if a similar story was saved in the last 3 days
  const threeDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('articles')
    .select('id, title')
    .gte('created_at', threeDaysAgo);
  for (const r of recent ?? []) {
    if (isLikelyDuplicate(rewritten.headline, r.title)) {
      console.log(`Skipping duplicate: "${rewritten.headline}" ~ already saved as "${r.title}"`);
      await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
      return false;
    }
  }

    // Same publisher + same image = re-served/reposted article — always a duplicate
  const sourceImg = extractSourceImage(item);
  if (sourceImg) {
    const { data: imgDup } = await supabase
      .from('articles')
      .select('id, title')
      .eq('source_name', item.sourceName)
      .eq('image_url', sourceImg)
      .limit(1);
    if (imgDup && imgDup.length > 0) {
      console.log(`Skipping repost (same image): "${rewritten.headline}" ~ already saved as "${imgDup[0].title}"`);
      await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
      return false;
    }
  }

  // Image: publisher's own photo first (exact subject match), Unsplash as fallback
  const sourceImageUrl = extractSourceImage(item);
  let image;
  if (sourceImageUrl) {
    image = { url: sourceImageUrl, creditName: item.sourceName, creditUrl: item.link };
  } else {
    image = await fetchImage(rewritten, category, usedKeys);
  }

  const { error } = await supabase.from('articles').insert({
    title: rewritten.headline,
    summary: rewritten.summary,
    body: rewritten.body,
    category: category,
    region: region,
    source_url: item.link,
    source_name: item.sourceName,
    reliability: rewritten.reliability === 'verified' ? 'verified' : 'claimed',
    glossary: Array.isArray(rewritten.glossary) ? rewritten.glossary : [],
    published: true,
    image_url: image?.url ?? null,
    image_credit_name: image?.creditName ?? null,
    image_credit_url: image?.creditUrl ?? null,
  });
  if (error) {
    console.error(`Failed to save article: ${error.message}`);
    return false;
  }
  console.log(`Saved: ${rewritten.headline} [${category} · ${region}]`);
  return true;
}
// ---- 6. MAIN ----
async function run() {
  console.log('Checking sources for new articles...');
  const newItems = await fetchNewItems();
  console.log(`Found ${newItems.length} new item(s).`);

  const usedKeys = await loadUsedImageKeys();

  const MAX_PER_RUN = 10;
  const batch = newItems.slice(0, MAX_PER_RUN);
  if (newItems.length > MAX_PER_RUN) {
    console.log(`Processing ${MAX_PER_RUN} of ${newItems.length} — the rest will be picked up on the next run.`);
  }

  let saved = 0, rejected = 0, failed = 0;
  for (const item of batch) {
    try {
      const rewritten = await rewriteArticle(item);

      if (rewritten?.reject) {
        console.log(`Rejected (not tech): ${item.title} — ${rewritten.reason ?? ''}`);
        await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
        rejected++;
        continue;
      }

      const ok = await saveArticle(item, rewritten, usedKeys);
      if (ok) saved++; else failed++;
    } catch (err) {
      console.error(`Skipping "${item.title}" — ${err.message}`);
      await supabase.from('processed_urls').insert({ source_url: item.link, status: 'failed' });
      failed++;

      // If every provider was down for this article, abort the batch —
      // remaining articles would fail identically and burn more quota
      if (providerDown.gemini && providerDown.glm && providerDown.groq && providerDown.groq20b && providerDown.mistral && providerDown.nvidia && providerDown.nvidia2) {
        console.log('All providers exhausted — ending this run early. Providers recover before the next run.');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 5000)); // 5s gap — gentler on free-tier rate limits
  }

  console.log(`Run complete. Saved: ${saved}, Rejected: ${rejected}, Failed: ${failed}`);
}

run();
