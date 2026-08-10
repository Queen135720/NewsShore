// NewsShore automation pipeline
// This script: 1) checks RSS feeds for new articles, 2) rewrites them with AI,
// 3) saves the result to Supabase so the website can display them.

import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';

const parser = new Parser();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service key = write access, kept secret
);

// ---- 1. SOURCES ----
// Each source has: the RSS feed URL, which category it belongs to, and its region.
const SOURCES = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Anthropic', url: 'https://www.anthropic.com/news/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', category: 'AI News', region: 'US' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml', category: 'AI News', region: 'Global' },
  { name: 'MIT News - AI', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2', category: 'Research', region: 'US' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI News', region: 'Global' },
  { name: 'TechCrunch (Startups/Funding)', url: 'https://techcrunch.com/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'Rest of World', url: 'https://restofworld.org/feed/latest/', category: 'Global & China', region: 'Global' },
  { name: 'WIRED RSS feed', url: 'https://www.wired.com/feed/rss', category: 'Tech News', region: 'Global' },
  { name: 'The Verge RSS feed', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech News', region: 'Global' },
  { name: 'Ars Technica RSS feed', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech News', region: 'Global' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'AI News', region: 'Global' },
  { name: 'VentureBeat Startups', url: 'https://venturebeat.com/category/startups/feed/', category: 'Startups & Funding', region: 'Global' },
  { name: 'VentureBeat Tech & Science', url: 'https://venturebeat.com/category/tech/feed/', category: 'Tech News', region: 'Global' },
  { name: 'Nature - Tech & Science', url: 'https://www.nature.com/subjects/technology.rss', category: 'Research', region: 'Global' },
  { name: 'MIT Technology Review - AI', url: 'https://www.technologyreview.com/feed/', category: 'AI News', region: 'US' },
  { name: 'MIT Technology Review - Startups & Funding', url: 'https://www.technologyreview.com/startups/feed/', category: 'Startups & Funding', region: 'US' },
  { name: 'MIT Technology Review - Tech & Science', url: 'https://www.technologyreview.com/tech/feed/', category: 'Tech News', region: 'US' },
  { name: 'MIT Technology Review - Global & China', url: 'https://www.technologyreview.com/global/feed/', category: 'Global & China', region: 'Global' },
  { name: 'MIT Technology Review - Research', url: 'https://www.technologyreview.com/research/feed/', category: 'Research', region: 'Global' },
  { name: 'Engadget rss feed', url: 'https://www.engadget.com/rss.xml', category: 'Tech News', region: 'Global' },
  { name: 'The New York Times Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'Tech Giants', region: 'US' },
  { name: 'Vox', url: 'https://www.vox.com/rss/recode/index.xml', category: 'Tech Giants', region: 'US' },
  { name: 'Zdnet RSS feed', url: 'https://www.zdnet.com/news/rss.xml', category: 'Tech News', region: 'Global' },
  { name: 'Network world RSS feeds', url: 'https://www.networkworld.com/feed/', category: 'Tech News', region: 'Global' },
  { name: 'Mercury News', url: 'https://www.mercurynews.com/tag/siliconbeat/feed/', category: 'Tech Giants', region: 'Global' },
  { name: 'Ars Technica', url: 'https://arstechnica.com/tag/self-driving-cars/feed/', category: 'Tech News', region: 'Global' },
  { name: 'Extreme Tech', url: 'https://www.extremetech.com/feed/', category: 'Tech News', region: 'Global' },
  { name: 'Apple Insider', url: 'https://appleinsider.com/rss/news/', category: 'Tech Giants', region: 'Global' },
  { name: 'CNET RSS', url: 'https://www.cnet.com/rss/news/', category: 'Tech News', region: 'Global' },
  { name: 'FossBytes', url: 'https://fossbytes.com/feed/?x=1', category: 'Tech News', region: 'Global' },
  { name: 'Medgadget', url: 'https://feeds.feedburner.com/Medgadget', category: 'Research', region: 'Global' },
  { name: 'TechCentral', url: 'http://www.techcentral.ie/feed/', category: 'Tech News', region: 'Global' },
  { name: 'Futurefive', url: 'https://futurefive.co.nz/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechNode RSS', url: 'https://technode.com/feed/', category: 'Global & China', region: 'China' },
  { name: 'Tech in Asia', url: 'https://www.techinasia.com/feed/', category: 'Global & China', region: 'Asia' },
  { name: 'Nocamels ', url: 'https://nocamels.com/feed/', category: 'Global & China', region: 'Israel' },
  { name: 'It News', url: 'https://www.itnews.com.au/rss/rss.ashx', category: 'Tech News', region: 'Australia' },
  { name: 'Geeky', url: 'https://geeky.com.ng/feed/', category: 'Global & China', region: 'Nigeria' },
  { name: 'Techpoint Africa', url: 'https://techpoint.africa/feed/', category: 'Startups & Funding', region: 'Africa' },
  { name: 'TechCabal', url: 'https://techcabal.com/feed/', category: 'Startups & Funding', region: 'Africa' },
  { name: 'Tech news Africa', url: 'https://www.techafricanews.com/feed/', category: 'Global & China', region: 'Africa' },
  { name: 'feeds2.feedburner.com/PennOlson', url: 'https://feeds2.feedburner.com/PennOlson', category: 'Global & China', region: 'Asia' },
  { name: 'Quantum Computing Report', url: 'https://quantumcomputingreport.com/news/feed/', category: 'Research', region: 'Global' },
  { name: 'Scott Aaronson Blog', url: 'https://scottaaronson.blog/?feed=rss2', category: 'Research', region: 'Global' },
  { name: 'RoboHub', url: 'https://robohub.org/feed/', category: 'Tech News', region: 'Global' },
  { name: 'TechXplore Robotics', url: 'https://techxplore.com/rss-feed/robotics-news/', category: 'Tech News', region: 'Global' },
  { name: 'Robots Tomorrow', url: 'https://www.roboticstomorrow.com/rss/news.xml', category: 'Tech News', region: 'Global' },
  { name: 'Data Center News', url: 'https://datacenternews.asia/feed/', category: 'Tech Giants', region: 'Global' },
  { name: 'Cisco Data Center Blog', url: 'https://blogs.cisco.com/datacenter/feed/', category: 'Tech Giants', region: 'Global' },
  { name: 'Z.AI x blog', url: 'https://rss.app/feeds/axkjpzpvqOoyo3Cl.xml', category: 'Global & China', region: 'China' },
  { name: 'Moonshot x (Kimi) blog', url: 'https://moonshot.global/blog/feed/', category: 'Global & China', region: 'China' },
  { name: 'DeepSeek x blog', url: 'https://rss.app/feeds/zTibLu7faQOBjTRS.xml', category: 'Global & China', region: 'China' },
  { name: 'Musk news', url: 'http://x.ai/news', category: 'AI News', region: 'US' },
  { name: 'IBM Quantum blog', url: 'https://newsroom.ibm.com/announcements?pagetemplate=rss', category: 'Research', region: 'Global' },
  { name: 'Google Quantum AI blog', url: 'https://research.google/blog/rss', category: 'Research', region: 'Global' },
  // NOTE: DeepSeek, Z.ai (GLM), Moonshot (Kimi), Musk/Gates individually, and quantum computing
  // labs (IBM Quantum, Google Quantum AI) often don't have clean public RSS feeds.
  // Those need a secondary check via a general tech-news aggregator feed, or periodic manual
  // review, rather than a direct feed — add once this core pipeline is confirmed working.
];

// ---- 2. FETCH NEW ITEMS ----
async function fetchNewItems() {
  const allItems = [];
  for (const source of SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const latest = feed.items.slice(0, 3); // only look at the 3 newest per source, per run
      for (const item of latest) {
        // Skip if we've already saved this exact source link before
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
      // If one source fails (feed down, changed format, etc.) we log it and keep going —
      // one broken source should never stop the whole pipeline.
      console.error(`Failed to fetch ${source.name}:`, err.message);
    }
  }
  return allItems;
}

// ---- 3. REWRITE WITH AI ----
// Tries Gemini first. If Gemini fails (rate limit, outage), falls back to GLM automatically.
async function rewriteArticle(item) {
  const prompt = `You are a neutral tech news writer for a general, non-technical global audience.
You have access to a real web search tool. Use it to find additional real, verifiable context for this story — such as analyst commentary, related coverage, or specific figures — but ONLY include information you actually find through search or that appears in the source text below. Never state something as fact unless you found it through search or it's in the source.

Rewrite the following into:
1. A clear headline (under 12 words)
2. A 2-3 sentence summary that captures the key points and context of the article
3. A 500-1000 word article body, fully in your own words (never copy phrases from the original) but make sure it is verifiable and accurate. Include relevant context, background, and implications for the industry involved and society. Avoid speculation or unverified claims.
4. A "reliability" tag: "verified" if this comes from independent testing/reporting, or "claimed" if it's a company's own announcement about itself
5. Three to ten short glossary terms (a technical word used in the piece + a one-sentence plain-language explanation)
6. If — and only if — the source content or your real search results include any of the following, incorporate it naturally: analyst/expert quotes, specific dates/numbers/market data, historical comparisons, competitor or investor reactions, regulatory context. Do NOT add any of these if you did not find them via search or the source text. Never fabricate a link, citation, or URL — only include a link if your search tool actually returned it.
7. Do not invent any quotes, sources, statistics, or links. If neither the source nor your search results contain something, leave it out rather than filling the gap.

Respond ONLY in this exact JSON format, nothing else:
{"headline": "...", "summary": "...", "body": "...", "reliability": "...", "glossary": [{"term":"...","definition":"..."}]}

Source title: ${item.title}
Source content: ${item.contentSnippet || item.content || ''}`;

  try {
    return await callGemini(prompt);
  } catch (err) {
    console.warn('Gemini failed, falling back to GLM:', err.message);
    return await callGLM(prompt);
  }
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }], // <-- enables REAL web search, not just a prompt instruction
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function callGLM(prompt) {
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-5-turbo',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`GLM error: ${res.status}`);
  const data = await res.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ---- fetch image from unsplash ----
async function fetchImage(headline) {
  const query = encodeURIComponent(headline.split(' ').slice(0, 5).join(' ')); // first few words as search terms
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
  );
  if (!res.ok) {
    console.warn('Unsplash fetch failed, article will save without an image');
    return null;
  }
  const data = await res.json();
  return data.results[0]?.urls?.regular || null;
}

// ---- 4. SAVE TO SUPABASE ----
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
    image_url: imageUrl,   // <-- new field
  });
  if (error) console.error('Failed to save article:', error.message);
  else console.log(`Saved: ${rewritten.headline}`);
}

// ---- MAIN ----
async function run() {
  console.log('Checking sources for new articles...');
  const newItems = await fetchNewItems();
  console.log(`Found ${newItems.length} new item(s).`);

  for (const item of newItems) {
    const rewritten = await rewriteArticle(item);
    await saveArticle(item, rewritten);
  }
  console.log('Run complete.');
}

run();
