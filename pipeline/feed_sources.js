/* feed_sources.js — drop-in feed source module for NewsShore's fetch-and-publish.js
 *
 * WHAT IT DOES
 *   1. loadSources('feeds.opml')     -> [{name, url, folder, category}, ...]
 *      reads the verified feed bundle (feeds_global_research.opml) and maps each
 *      OPML folder to a site category (AI / Robotics / Quantum / Tech News / Research).
 *   2. fetchFeed(source)             -> parsed items for ONE feed
 *      {source, category, title, link, published, published_ts, summary, feed_url}
 *   3. fetchAll(sources, opts)       -> {items, failed} across all feeds,
 *      tolerant: a feed that 403s or times out is reported in `failed`, never thrown.
 *
 * ZERO npm dependencies. Node 18+ (global fetch). Server-side only (no CORS).
 *
 * WIRING (in fetch-and-publish.js):
 *   const { loadSources, fetchAll } = require('./feed_sources');
 *   const sources = loadSources('feeds.opml', { excludeFolders: ['Papers - arXiv & Journals'] });
 *   const { items, failed } = await fetchAll(sources);
 *   // then feed `items` into your existing rewrite/save step as article rows
 */

'use strict';
const fs = require('fs');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* OPML folder -> NewsShore category. GN: entries get a keyword pass too. */
const CATEGORY_MAP = {
  'AI - Frontier Labs': 'AI',
  'AI - Other Regions (Asia, Africa, LatAm)': 'AI',
  'AI - Newsletters & Analyst Blogs': 'AI',
  'Robotics - Research, Industry & Media': 'Robotics',
  'Quantum - Industry, Research & Media': 'Quantum',
  'News - Aggregators & Tech Media': 'Tech News',
  'Papers - arXiv & Journals': 'Research',
  'Google News - Lab & Topic Watchlist (query feeds)': 'AI',
  'Google News - Regional Editions (all continents)': 'Tech News',
};

/* keyword overrides for the Google News watchlist folder */
const GN_KEYWORDS = [
  [/robot|optimus|unitree|figure ai|boston dynamics|1x/i, 'Robotics'],
  [/quantum|qubit|ionq|psiquantum|quantinuum|quera|rigetti|xanadu/i, 'Quantum'],
];

function categoryFor(folder, name) {
  if (folder.startsWith('Google News - Lab')) {
    for (const [re, cat] of GN_KEYWORDS) {
      if (re.test(name)) return cat;
    }
  }
  return CATEGORY_MAP[folder] || 'Tech News';
}

/* ---- OPML parsing (walk outline tags, track the open folder) ---- */
function loadSources(opmlPath, opts) {
  const o = opts || {};
  const xml = fs.readFileSync(opmlPath, 'utf8');
  const tokens = [...xml.matchAll(/<outline\b([^>]*?)\/>|<outline\b([^>]*?)>|<\/outline>/g)];
  const stack = [];
  const sources = [];
  for (const m of tokens) {
    if (m[0] === '</outline>') { stack.pop(); continue; }
    const attrs = m[1] !== undefined ? m[1] : m[2];
    const get = (k) => {
      const mm = attrs.match(new RegExp(k + '="([^"]*)"'));
      return mm ? mm[1] : '';
    };
    const xmlUrl = get('xmlUrl');
    if (xmlUrl) {
      const folder = unescapeXml(stack[stack.length - 1] || 'Uncategorized');
      const label = unescapeXml(get('text') || get('title') || xmlUrl);
      if (o.excludeFolders && o.excludeFolders.includes(folder)) continue;
      if (o.includeFolders && !o.includeFolders.includes(folder)) continue;
      sources.push({
        name: label,
        url: xmlUrl,
        folder,
        category: categoryFor(folder, label),
      });
    } else {
      stack.push(unescapeXml(get('text') || ''));
    }
  }
  return sources;
}

/* ---- minimal RSS 2.0 / Atom / RDF item extraction ---- */
function stripCdata(s) {
  return String(s || '').replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
}
function unescapeXml(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function stripHtml(s, limit) {
  return unescapeXml(String(s || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim().slice(0, limit || 280);
}

function parseFeed(xml) {
  const items = [];
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g)];
  for (const b of blocks) {
    const body = b[2];
    const pick = (tags) => {
      for (const t of tags) {
        const m = body.match(new RegExp('<' + t + '\\b[^>]*>([\\s\\S]*?)</' + t + '>'));
        if (m) return stripCdata(m[1]);
      }
      return '';
    };
    // link: Atom href first (prefer alternate), then RSS text link
    let link = '';
    const alt = body.match(/<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"/);
    const anyHref = body.match(/<link\b[^>]*href="([^"]+)"/);
    const rssLink = body.match(/<link\b[^>]*>([^<]+)<\/link>/);
    link = (alt && alt[1]) || (anyHref && anyHref[1]) || (rssLink && rssLink[1].trim()) || '';
    const title = stripHtml(pick(['title']), 200);
    const dateRaw = pick(['pubDate', 'published', 'updated', 'dc:date', 'date']);
    const ts = dateRaw ? Date.parse(dateRaw.trim()) : NaN;
    const summary = stripHtml(pick(['description', 'summary']), 280);
    if (title || link) {
      items.push({ title, link, published: ts ? new Date(ts).toISOString() : dateRaw.trim(), published_ts: isNaN(ts) ? 0 : ts, summary });
    }
  }
  return items;
}

/* ---- fetching ---- */
async function fetchFeed(source, opts) {
  const o = opts || {};
  const timeoutMs = o.timeoutMs || 20000;
  const res = await fetch(source.url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const xml = await res.text();
  const raw = parseFeed(xml).slice(0, o.maxPerFeed || 40);
  return raw.map((i) => ({ ...i, source: source.name, category: source.category, feed_url: source.url }));
}

/* Fetch everything with bounded concurrency; failures collected, never thrown. */
async function fetchAll(sources, opts) {
  const o = opts || {};
  const concurrency = o.concurrency || 12;
  const minTs = o.sinceTs || 0;
  const items = [];
  const failed = [];
  let idx = 0;
  async function worker() {
    while (idx < sources.length) {
      const src = sources[idx++];
      try {
        const got = await fetchFeed(src, o);
        for (const i of got) if (i.published_ts >= minTs) items.push(i);
      } catch (e) {
        failed.push({ source: src.name, error: String(e && e.message || e).slice(0, 90) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  items.sort((a, b) => b.published_ts - a.published_ts);
  // dedupe by link (fall back to title)
  const seen = new Set();
  const deduped = items.filter((i) => {
    const key = i.link || i.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { items: deduped, failed };
}

module.exports = { loadSources, fetchAll, fetchFeed, parseFeed, CATEGORY_MAP, categoryFor };

/* CLI smoke test:  node feed_sources.js feeds.opml 5   (fetch first 5 feeds) */
if (require.main === module) {
  const opml = process.argv[2] || 'feeds.opml';
  const limit = parseInt(process.argv[3] || '5', 10);
  (async () => {
    const sources = loadSources(opml);
    console.log(`${sources.length} sources in ${opml}`);
    const { items, failed } = await fetchAll(sources.slice(0, limit));
    console.log(`fetched ${items.length} items from ${limit} feeds; failed: ${failed.length}`);
    for (const i of items.slice(0, 5)) {
      console.log(`  ${i.published.slice(0, 16)}  [${i.category}] ${i.source}: ${i.title.slice(0, 70)}`);
    }
    for (const f of failed) console.log(`  FAILED ${f.source}: ${f.error}`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
