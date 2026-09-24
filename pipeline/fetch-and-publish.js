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

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'NewsShore-Bot/1.0 (https://newsshore.com)',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ---- 1. SOURCES ----
const SOURCES = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', category: 'AI News', region: 'Global' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI News', region: 'Global' },
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'WIRED', url: 'https://www.wired.com/feed/rss', category: 'Tech News', region: 'Global' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech News', region: 'Global' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech News', region: 'Global' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'Tech News', region: 'Global' },
  { name: 'CNET', url: 'https://www.cnet.com/rss/news/', category: 'Tech News', region: 'Global' },
  { name: 'Apple Insider', url: 'https://appleinsider.com/rss/news/', category: 'Tech Giants', region: 'Global' },
  { name: 'MIT News AI', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', category: 'Research', region: 'US' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'AI News', region: 'US' },
  { name: 'Nature Tech', url: 'https://www.nature.com/subjects/technology.rss', category: 'Research', region: 'Global' },
  { name: 'Rest of World', url: 'https://restofworld.org/feed/latest/', category: 'Global & China', region: 'Global' },
  { name: 'TechCabal', url: 'https://techcabal.com/feed/', category: 'Startups & Funding', region: 'Africa' },
  { name: 'TechNode', url: 'https://technode.com/feed/', category: 'Global & China', region: 'China' },
  { name: 'Nocamels', url: 'https://nocamels.com/feed/', category: 'Global & China', region: 'Israel' },
  { name: 'Quantum Computing Report', url: 'https://quantumcomputingreport.com/news/feed/', category: 'Research', region: 'Global' },
];

// ---- 2. FETCH NEW ITEMS ----
async function fetchNewItems() {
  const allItems = [];
  for (const source of SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const latest = feed.items.slice(0, 3);
      for (const item of latest) {
        const { data: existing } = await supabase
          .from('articles')
          .select('id')
          .eq('source_url', item.link)
          .maybeSingle();
        if (!existing) {
          allItems.push({ ...item, sourceName: source.name, category: source.category, region: source.region });
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${source.name}: ${err.message?.substring(0, 100)}`);
    }
  }
  return allItems;
}

// ---- 3. REWRITE WITH AI ----
async function rewriteArticle(item) {
  const prompt = `You are a neutral tech news writer for a general, non-technical global audience.
Rewrite the following into:
1. A clear headline (under 12 words)
2. A 2-3 sentence summary that captures the key points
3. A 500-1000 word article body, fully in your own words but accurate and verifiable. Do not copy phrases from the original.
4. A "reliability" tag: "verified" if from independent testing/reporting, or "claimed" if it's a company announcement
5. Three to ten short glossary terms (technical word + one-sentence plain-language explanation)
6. Three stock-photo search queries (2-4 words each) to illustrate this story. Rules: describe things you can SEE — objects, machines, places, people (e.g. "data center aisle", "robot arm factory", "circuit board macro"). NEVER use company or brand names — describe the product or industry instead (e.g. for a Nvidia chip story use "computer chip closeup"). Never abstract words alone like "future" or "innovation".

IMPORTANT RULES:
- Do not invent quotes, sources, statistics, or links.
- Do not fabricate any information not present in the source text.
- If you don't know something, leave it out rather than guessing.

Respond ONLY in this exact JSON format, nothing else:
{"headline": "...", "summary": "...", "body": "...", "reliability": "...", "glossary": [{"term":"...","definition":"..."}], "imageQueries": ["...", "...", "..."]}

Source title: ${item.title}
Source content: ${item.contentSnippet || item.content || ''}`;

  try { return await callGemini(prompt); }
  catch (err) { console.warn(`Gemini failed, falling back to GLM: ${err.message}`); }
  try { return await callGLM(prompt); }
  catch (err) { console.warn(`GLM failed, falling back to Groq: ${err.message}`); }
  try { return await callGroq(prompt); }
  catch (err) { console.warn(`Groq failed, falling back to DeepSeek: ${err.message}`); }
  return await callDeepSeek(prompt);
}

async function retryFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 429) {
    console.log('  Got 429, waiting 10s and retrying...');
    await new Promise(r => setTimeout(r, 10000));
    return fetch(url, options);
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

async function callGLM(prompt) {
  if (!process.env.GLM_API_KEY) throw new Error('GLM_API_KEY not set');
  const res = await retryFetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GLM_API_KEY}` },
    body: JSON.stringify({ model: 'glm-4.7-flash', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GLM error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await retryFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
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
  if (!rewritten?.headline?.trim() || !rewritten?.body?.trim() || !rewritten?.summary?.trim()) {
    console.log('Skipping empty article:', item.title ?? item.link);
    return false;
  }

  const image = await fetchImage(rewritten, item.category, usedKeys);

  const { error } = await supabase.from('articles').insert({
    title: rewritten.headline,
    summary: rewritten.summary,
    body: rewritten.body,
    category: item.category,
    region: item.region,
    source_url: item.link,
    source_name: item.sourceName,
    reliability: rewritten.reliability,
    glossary: rewritten.glossary,
    published: true,
    image_url: image?.url ?? null,
    image_credit_name: image?.creditName ?? null,
    image_credit_url: image?.creditUrl ?? null,
  });
  if (error) {
    console.error(`Failed to save article: ${error.message}`);
    return false;
  }
  console.log(`Saved: ${rewritten.headline}`);
  return true;
}

// ---- 6. MAIN ----
async function run() {
  console.log('Checking sources for new articles...');
  const newItems = await fetchNewItems();
  console.log(`Found ${newItems.length} new item(s).`);

  const usedKeys = await loadUsedImageKeys(); // ★ new — dedup memory vs last 300 articles

  const MAX_PER_RUN = 1;
  const batch = newItems.slice(0, MAX_PER_RUN);
  if (newItems.length > MAX_PER_RUN) {
    console.log(`Processing ${MAX_PER_RUN} of ${newItems.length} — the rest will be picked up on the next run.`);
  }

  let saved = 0;
  let failed = 0;
  for (const item of batch) {
    try {
      const rewritten = await rewriteArticle(item);
      const ok = await saveArticle(item, rewritten, usedKeys);
      if (ok) saved++; else failed++;
    } catch (err) {
      console.error(`Skipping "${item.title}" — all 4 AI providers failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`Run complete. Saved: ${saved}, Failed: ${failed}`);
}

run();
