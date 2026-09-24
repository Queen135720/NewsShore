// backfill-images.js
// Run:  node backfill-images.js 5     ← fix just 5 articles (for the Unsplash screenshot)
// Run:  node backfill-images.js       ← fix ALL articles (run this after Production approval)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const LIMIT = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;

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
  let res = await fetch(url, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } });

  // Demo tier auto-pause: when the 50/hour cap is hit, wait it out and continue
  if (res.status === 403 || res.status === 429) {
    console.log('  Unsplash hourly limit hit — pausing 61 min (continues automatically)...');
    await new Promise((r) => setTimeout(r, 61 * 60 * 1000));
    res = await fetch(url, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } });
  }
  if (!res.ok) { console.log(`  search failed (${res.status}) for "${query}"`); return []; }
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

async function fetchImageFor(title, category, usedKeys) {
  const queries = [titleToQuery(title), ...(CATEGORY_IMAGE_TERMS[category] ?? CATEGORY_IMAGE_TERMS['Latest'])].filter(Boolean);
  for (const q of queries) {
    const candidates = await searchUnsplash(q, usedKeys);
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * Math.min(12, candidates.length))];
      usedKeys.add(pick.key);
      return pick;
    }
  }
  return null;
}

async function run() {
  const { data: rows } = await supabase
    .from('articles')
    .select('id, title, category, image_url, created_at')
    .order('created_at', { ascending: false });

  const usedKeys = new Set();
  const toFix = [];
  for (const a of rows ?? []) {
    const url = a.image_url ?? '';
    const key = imageKey(url);
    if (!url || BANNED.test(url) || (key && usedKeys.has(key))) toFix.push(a);
    else usedKeys.add(key);
  }
  console.log(`Total: ${rows?.length ?? 0} — need re-imaging: ${toFix.length}${LIMIT !== Infinity ? ` (stopping at ${LIMIT})` : ''}`);

  let done = 0;
  for (const a of toFix) {
    if (done >= LIMIT) break;
    const image = await fetchImageFor(a.title, a.category, usedKeys);
    if (image) {
      await supabase.from('articles').update({
        image_url: image.url,
        image_credit_name: image.creditName,
        image_credit_url: image.creditUrl,
      }).eq('id', a.id);
      console.log(`✓ https://newsshore.com/article/${a.id} — ${a.title.slice(0, 70)}`);
    } else {
      console.log(`✗ kept old image — ${a.title.slice(0, 70)}`);
    }
    done++;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`Done. ${done} processed. Open any ✓ link above to see the credit line.`);
}

run();
