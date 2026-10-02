import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fetchHfDatasetRows } from '@/lib/hf-dataset';

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
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    // Validate: must have models array
    if (!raw?.models?.length) return null;
    return raw as ArenaCache;
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
/*  Fetch fresh data from HuggingFace Dataset Server API               */
/* ------------------------------------------------------------------ */
async function fetchFromHfApi(): Promise<ArenaCache | null> {
  try {
    const rows = await fetchHfDatasetRows('text', 'latest', {
      concurrency: 5,
      timeout: 25000,
    });

    // Filter to "overall" category only
    const overallRows = rows.filter(
      (r) => r.category === 'overall'
    ) as Array<{
      model_name: string;
      organization: string;
      license: string;
      rating: number;
      rating_lower: number;
      rating_upper: number;
      vote_count: number;
      rank: number;
    }>;

    if (overallRows.length === 0) return null;

    // Sort by rank
    overallRows.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

    const models: ArenaModel[] = overallRows.map((r) => ({
      rank: Math.round(r.rank),
      rank_lower: Math.round(r.rating_lower),
      rank_upper: Math.round(r.rating_upper),
      model_key: r.model_name,
      name: r.model_name,
      arena_score: Math.round(r.rating),
      ci_lower: Math.round(r.rating_lower),
      ci_upper: Math.round(r.rating_upper),
      votes: Math.round(r.vote_count || 0),
      organization: r.organization || '',
      url: 'https://arena.ai/leaderboard/text',
      license: r.license || 'Proprietary',
      input_price: null,
      output_price: null,
      context: null,
    }));

    const cache: ArenaCache = {
      fetchedAt: new Date().toISOString(),
      source: 'HuggingFace Dataset API (lmarena-ai/leaderboard-dataset)',
      sourceUrl: 'https://arena.ai/leaderboard/text',
      methodology: 'https://arena.ai/leaderboard/text',
      totalModels: models.length,
      models,
    };

    saveCache(cache);
    return cache;
  } catch (e) {
    console.error('[arena-leaderboard] HF API fetch failed:', e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/arena-leaderboard                                         */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  // 1. Try fresh data from HuggingFace Dataset Server API
  const fresh = await fetchFromHfApi();

  // 2. Fall back to disk/memory cache (if fresh fetch failed but we have recent cache)
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
