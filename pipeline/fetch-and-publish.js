// NewsShore automation pipeline (FINAL)
// This script: 1) checks RSS feeds for new articles, 2) rewrites them with AI,
// 3) saves the result to Supabase so the website can display them.
//
// Changes from original:
//   - Only 19 verified working feeds (33 dead/blocked feeds removed)
//   - GLM model: glm-4.7-flash (free tier, not glm-5-turbo which is paid)
//   - Batch cap: 8 articles per run (rest picked up on next cron)
//   - 4s delay between articles (avoids free-tier rate limits)
//   - Robust parser config (timeout, user-agent, XML entity handling)
//   - Better AI prompt (anti-fabrication rules)

import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'NewsShore-Bot/1.0 (https://newsshore.com)',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  },
  customFields: {
    item: ['media:content', 'media:thumbnail'],
  },
  xml2js: {
    explicitCharkey: false,
    normalizeTags: true,
    normalize: true,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ---- 1. SOURCES ----
// Only feeds verified working (tested Aug 2025).
// Removed: Anthropic(404), VentureBeat(403), Futurefive(406), Tech in Asia(406),
//   NYT(paywall), Vox(404), ZDNet(blocked), NetworkWorld(blocked), MercuryNews(blocked),
//   ExtremeTech(404), FossBytes(403), Medgadget(timeout), TechCentral(timeout),
//   ITNews(blocked), Geeky(timeout), TechpointAfrica(403), TechAfricaNews(403),
//   PennOlson(404), ScottAaronson(timeout), RoboHub(404), TechXplore(403),
//   RobotsTomorrow(404), DataCenterNews(404), CiscoBlog(404),
//   ZAI/Moonshot/DeepSeek rss.app feeds(broken), Musk/x.ai(not RSS),
//   IBMQuantum(404), GoogleQuantum(404), MIT sub-feeds(404)
const SOURCES = [
  // AI Companies
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', category: 'AI News', region: 'Global' },

  // Major Tech Publications
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI News', region: 'Global' },
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'WIRED', url: 'https://www.wired.com/feed/rss', category: 'Tech News', region: 'Global' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech News', region: 'Global' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech News', region: 'Global' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'Tech News', region: 'Global' },
  { name: 'CNET', url: 'https://www.cnet.com/rss/news/', category: 'Tech News', region: 'Global' },
  { name: 'Apple Insider', url: 'https://appleinsider.com/rss/news/', category: 'Tech Giants', region: 'Global' },

  // Research
  { name: 'MIT News AI', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', category: 'Research', region: 'US' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'AI News', region: 'US' },
  { name: 'Nature Tech', url: 'https://www.nature.com/subjects/technology.rss', category: 'Research', region: 'Global' },

  // Startups & Funding
  { name: 'Rest of World', url: 'https://restofworld.org/feed/latest/', category: 'Global & China', region: 'Global' },
  { name: 'TechCabal', url: 'https://techcabal.com/feed/', category: 'Startups & Funding', region: 'Africa' },

  // China / Asia
  { name: 'TechNode', url: 'https://technode.com/feed/', category: 'Global & China', region: 'China' },
  { name: 'Nocamels', url: 'https://nocamels.com/feed/', category: 'Global & China', region: 'Israel' },

  // Quantum
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
// Tries Gemini first. If Gemini fails (rate limit, outage), falls back to GLM.
async function rewriteArticle(item) {
  const prompt = `You are a neutral tech news writer for a general, non-technical global audience.
Rewrite the following into:
1. A clear headline (under 12 words)
2. A 2-3 sentence summary that captures the key points
3. A 500-1000 word article body, fully in your own words but accurate and verifiable. Do not copy phrases from the original.
4. A "reliability" tag: "verified" if from independent testing/reporting, or "claimed" if it's a company announcement
5. Three to ten short glossary terms (technical word + one-sentence plain-language explanation)

IMPORTANT RULES:
- Do not invent quotes, sources, statistics, or links.
- Do not fabricate any information not present in the source text.
- If you don't know something, leave it out rather than guessing.

Respond ONLY in this exact JSON format, nothing else:
{"headline": "...", "summary": "...", "body": "...", "reliability": "...", "glossary": [{"term":"...","definition":"..."}]}

Source title: ${item.title}
Source content: ${item.contentSnippet || item.content || ''}`;

  try {
    return await callGemini(prompt);
  } catch (err) {
    console.warn(`Gemini failed, falling back to GLM: ${err.message}`);
    return await callGLM(prompt);
  }
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
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
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function callGLM(prompt) {
  if (!process.env.GLM_API_KEY) throw new Error('GLM_API_KEY not set');

  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4.7-flash',  // FREE tier model (glm-5-turbo requires paid plan)
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GLM error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ---- 4. FETCH IMAGE FROM UNSPLASH ----
async function fetchImage(headline) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;
  const query = encodeURIComponent(headline.split(' ').slice(0, 5).join(' '));
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results[0]?.urls?.regular || null;
  } catch {
    return null;
  }
}

// ---- 5. SAVE TO SUPABASE ----
async function saveArticle(item, rewritten) {
  const imageUrl = await fetchImage(rewritten.headline);

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
    image_url: imageUrl,
  });
  if (error) {
    console.error(`Failed to save article: ${error.message}`);
    return false;
  }
  console.log(`Saved: ${rewritten.headline}`);
  return true;
}

// ---- 6. MAIN ----
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Checking sources for new articles...');
  const newItems = await fetchNewItems();
  console.log(`Found ${newItems.length} new item(s).`);

  // Only process a limited batch per run to stay under free-tier rate limits.
  // The rest will be picked up on the next cron run (every 5 min).
  const MAX_PER_RUN = 8;
  const batch = newItems.slice(0, MAX_PER_RUN);
  if (newItems.length > MAX_PER_RUN) {
    console.log(`Processing ${MAX_PER_RUN} of ${newItems.length} — the rest will be picked up on the next run.`);
  }

  let saved = 0;
  let failed = 0;
  for (const item of batch) {
    try {
      const rewritten = await rewriteArticle(item);
      const ok = await saveArticle(item, rewritten);
      if (ok) saved++; else failed++;
    } catch (err) {
      console.error(`Skipping "${item.title}" — both AI providers failed: ${err.message}`);
      failed++;
    }
    await sleep(4000); // 4s delay between articles to avoid rate limits
  }

  console.log(`Run complete. Saved: ${saved}, Failed: ${failed}`);
}

run();
