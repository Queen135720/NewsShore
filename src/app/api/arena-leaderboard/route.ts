import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface ArenaModel {
  rank: number;
  rank_lower: number;
  rank_upper: number;
  model_key: string;
  name: string;
  arena_score: number;
  ci_lower: number;
  ci_upper: number;
  votes: number;
  organization: string;
  url: string;
  license: string;
  input_price: number | null;
  output_price: number | null;
  context: number | null;
}

interface ArenaCache {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  methodology: string;
  totalModels: number;
  models: ArenaModel[];
}

/* ------------------------------------------------------------------ */
/*  Static fallback (bundled with the app, always available)           */
/* ------------------------------------------------------------------ */
import fallbackData from '@/data/arena-fallback.json';
const STATIC_FALLBACK: ArenaCache = fallbackData as ArenaCache;

/* ------------------------------------------------------------------ */
/*  Cache — uses /tmp on Vercel, data/ locally                        */
/* ------------------------------------------------------------------ */
const CACHE_DIR = process.env.VERCEL ? join(tmpdir(), 'newsshore') : join(process.cwd(), 'data');
const CACHE_PATH = join(CACHE_DIR, 'arena-cache.json');
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let memoryCache: { data: ArenaCache; readAt: number } | null = null;

function readCacheFile(): ArenaCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as ArenaCache;
  } catch {
    return null;
  }
}

function getCache(): ArenaCache | null {
  const now = Date.now();
  if (memoryCache && now - memoryCache.readAt < CACHE_TTL_MS) return memoryCache.data;
  const fresh = readCacheFile();
  if (fresh) memoryCache = { data: fresh, readAt: now };
  return fresh;
}

function saveCache(cache: ArenaCache): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('[arena-leaderboard] Failed to write cache:', e);
  }
  memoryCache = { data: cache, readAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/*  Fresh data fetch (disabled — SDK crashes in some environments)     */
/* ------------------------------------------------------------------ */
async function tryFetchOnce(): Promise<ArenaCache | null> {
  // The z-ai SDK page_reader is unstable in serverless/edge environments.
  // Data is kept fresh via the static fallback file (src/data/arena-fallback.json)
  // which should be updated periodically from arena.ai.
  return null;
}

/**
 * Parse the rendered HTML from arena.ai to extract leaderboard table rows.
 */
function parseArenaHtml(html: string): ArenaCache | null {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const models: ArenaModel[] = [];
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const text = cellMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      cells.push(text);
    }

    if (cells.length < 5) continue;

    const rankMatch = cells[0].match(/^(\d+)/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1]);

    const nameMatch = cells[2].match(/^(.+?)\n/);
    const orgMatch = cells[2].match(/\n(.+?) · /);
    const licMatch = cells[2].match(/· (.+)$/);

    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const org = orgMatch ? orgMatch[1].trim() : '';
    const license = licMatch ? licMatch[1].trim() : '';

    const scoreMatch = cells[3].match(/^(\d+)/);
    const ciMatch = cells[3].match(/±(\d+)/);

    if (!scoreMatch) continue;

    const score = parseInt(scoreMatch[1]);
    const ci = ciMatch ? parseInt(ciMatch[1]) : 0;

    const votesMatch = cells[4].replace(/,/g, '').match(/^(\d+)/);
    const votes = votesMatch ? parseInt(votesMatch[1]) : 0;

    models.push({
      rank,
      rank_lower: Math.max(1, rank - ci),
      rank_upper: rank + ci,
      model_key: name,
      name,
      arena_score: score,
      ci_lower: score - ci,
      ci_upper: score + ci,
      votes,
      organization: org,
      url: 'https://arena.ai/leaderboard/text',
      license,
      input_price: null,
      output_price: null,
      context: null,
    });
  }

  if (models.length === 0) return null;

  const cache: ArenaCache = {
    fetchedAt: new Date().toISOString(),
    source: 'arena.ai (LMArena)',
    sourceUrl: 'https://arena.ai/leaderboard/text',
    methodology: 'https://arena.ai/leaderboard/text',
    totalModels: models.length,
    models,
  };

  saveCache(cache);
  return cache;
}

/* ------------------------------------------------------------------ */
/*  GET /api/arena-leaderboard                                         */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  // 1. Try fresh data from arena.ai via SDK (once per instance)
  const fresh = await tryFetchOnce();

  // 2. Fall back to disk/memory cache
  let cache = fresh || getCache();

  // 3. Ultimate fallback: bundled static data (always available)
  if (!cache) {
    cache = STATIC_FALLBACK;
  }

  const models = cache.models.slice(0, limit);
  return NextResponse.json({
    success: true,
    source: cache.source,
    sourceUrl: cache.sourceUrl,
    methodology: cache.methodology,
    fetchedAt: cache.fetchedAt,
    totalModels: cache.totalModels,
    returnedModels: models.length,
    models,
  });
}
