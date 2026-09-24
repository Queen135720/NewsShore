// backfill-images.js — run ONCE. Re-images every watermarked, missing, or duplicated image.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BANNED = /(alamy|shutterstock|gettyimages|istockphoto|dreamstime|123rf|depositphotos)/i;

const BRAND_WORDS = new Set(['nvidia','openai','google','microsoft','apple','meta','amazon','anthropic','tesla','deepseek','qwen','baidu','alibaba','tencent','huawei','samsung','intel','amd','qualcomm','broadcom','oracle','ibm','xai','chatgpt','gemini','copilot','says','announces','launches','reveals']);

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

function titleToQuery(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !BRAND_WORDS.has(w)).slice(0, 4).join(' ');
}

async function searchUnsplash(query, usedKeys) {
  const url = 'https://api.unsplash.com/search/photos?query=' + encodeURIComponent(query) +
    '&per_page=30&orientation=landscape&content_filter=high';
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } });
  if (!res.ok) { console.log(`  search failed (${res.status}) for "${query}"`); return []; }
  const { results = [] } = await res.json();
  return results
    .filter((r) => !r.premium)
    .filter((r) => r.width >= 1600 && r.height >= 900)
    .filter((r) => !usedKeys.has(imageKey(r.urls.raw)))
    .map((r) => ({ url: `${r.urls.raw}&w=1600&q=80&fm=jpg`, key: imageKey(r.urls.raw) }));
}

async function fetchImageFor(title, category, usedKeys) {
  const queries = [titleToQuery(title), ...(CATEGORY_IMAGE_TERMS[category] ?? CATEGORY_IMAGE_TERMS['Latest'])].filter(Boolean);
  for (const q of queries) {
    const candidates = await searchUnsplash(q, usedKeys);
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * Math.min(12, candidates.length))];
      usedKeys.add(pick.key);
      return pick.url;
    }
  }
  return null;
}

async function run() {
  const { data: rows } = await supabase
    .from('articles')
    .select('id, title, category, image_url, created_at')
    .order('created_at', { ascending: false }); // newest first — newest keeps its image

  const usedKeys = new Set();
  const toFix = [];
  for (const a of rows ?? []) {
    const url = a.image_url ?? '';
    const key = imageKey(url);
    if (!url || BANNED.test(url) || (key && usedKeys.has(key))) toFix.push(a);
    else usedKeys.add(key);
  }
  console.log(`Total: ${rows?.length ?? 0} — re-imaging ${toFix.length} articles`);

  let done = 0;
  for (const a of toFix) {
    const url = await fetchImageFor(a.title, a.category, usedKeys);
    if (url) {
      await supabase.from('articles').update({ image_url: url }).eq('id', a.id);
      usedKeys.add(imageKey(url));
    }
    done++;
    if (done % 25 === 0) console.log(`${done}/${toFix.length}...`);
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log('Backfill complete. Refresh the site — no redeploy needed (force-dynamic).');
}

run();
