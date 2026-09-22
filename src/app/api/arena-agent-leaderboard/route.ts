import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface ArenaAgentModel {
  rank: number;
  rank_lower: number;
  rank_upper: number;
  model_key: string;
  name: string;
  organization: string;
  license: string;
  net_improvement: number;
  net_improvement_ci: number;
  confirmed_success: number;
  confirmed_success_ci: number;
  praise_vs_complaint: number;
  praise_vs_complaint_ci: number;
  steerability: number;
  steerability_ci: number;
  bash_recovery: number;
  bash_recovery_ci: number;
  tool_hallucination: number;
  tool_hallucination_ci: number;
  sessions: number;
  cost_per_task: number;
  output_tokens: number;
  input_price: number | null;
  output_price: number | null;
  context: number | null;
  url: string;
}

interface ArenaAgentsCache {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  methodology: string;
  totalModels: number;
  models: ArenaAgentsModel[];
}

/* ------------------------------------------------------------------ */
/*  Static fallback (bundled with the app, always available)           */
/* ------------------------------------------------------------------ */
import fallbackData from '@/data/arena-agent-fallback.json';
const STATIC_FALLBACK: ArenaAgentsCache = fallbackData as ArenaAgentsCache;

/* ------------------------------------------------------------------ */
/*  Cache — uses /tmp on Vercel, data/ locally                        */
/* ------------------------------------------------------------------ */
const CACHE_DIR = process.env.VERCEL ? join(tmpdir(), 'newsshore') : join(process.cwd(), 'data');
const CACHE_PATH = join(CACHE_DIR, 'arena-agent-cache.json');
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let memoryCache: { data: ArenaAgentsCache; readAt: number } | null = null;

function readCacheFile(): ArenaAgentsCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as ArenaAgentsCache;
  } catch {
    return null;
  }
}

function getCache(): ArenaAgentsCache | null {
  const now = Date.now();
  if (memoryCache && now - memoryCache.readAt < CACHE_TTL_MS) return memoryCache.data;
  const fresh = readCacheFile();
  if (fresh) memoryCache = { data: fresh, readAt: now };
  return fresh;
}

function saveCache(cache: ArenaAgentsCache): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('[arena-agent-leaderboard] Failed to write cache:', e);
  }
  memoryCache = { data: cache, readAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/*  Fresh data fetch (disabled — SDK crashes in some environments)     */
/* ------------------------------------------------------------------ */
async function tryFetchOnce(): Promise<ArenaAgentsCache | null> {
  return null;
}

/* ------------------------------------------------------------------ */
/*  GET /api/arena-agent-leaderboard                                   */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  const fresh = await tryFetchOnce();
  let cache = fresh || getCache();
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
