import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
/*  Cache                                                              */
/* ------------------------------------------------------------------ */
const CACHE_PATH = join(process.cwd(), 'data', 'arena-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
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

/* ------------------------------------------------------------------ */
/*  GET /api/arena-leaderboard                                         */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 386);

  const cache = getCache();
  if (!cache) {
    return NextResponse.json(
      { error: 'Arena leaderboard data unavailable.' },
      { status: 503 },
    );
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
