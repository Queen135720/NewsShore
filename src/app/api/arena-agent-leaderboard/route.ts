import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fetchHfDatasetRows } from '@/lib/hf-dataset';

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

interface ArenaAgentCache {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  methodology: string;
  totalModels: number;
  models: ArenaAgentModel[];
}

/* ------------------------------------------------------------------ */
/*  Static fallback (bundled with the app, always available)           */
/* ------------------------------------------------------------------ */
import fallbackData from '@/data/arena-agent-fallback.json';
const STATIC_FALLBACK: ArenaAgentCache = fallbackData as ArenaAgentCache;

/* ------------------------------------------------------------------ */
/*  Cache — uses /tmp on Vercel, data/ locally                        */
/* ------------------------------------------------------------------ */
const CACHE_DIR = process.env.VERCEL ? join(tmpdir(), 'newsshore') : join(process.cwd(), 'data');
const CACHE_PATH = join(CACHE_DIR, 'arena-agent-cache.json');
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let memoryCache: { data: ArenaAgentCache; readAt: number } | null = null;

function readCacheFile(): ArenaAgentCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    if (!raw?.models?.length) return null;
    return raw as ArenaAgentCache;
  } catch {
    return null;
  }
}

function getCache(): ArenaAgentCache | null {
  const now = Date.now();
  if (memoryCache && now - memoryCache.readAt < CACHE_TTL_MS) return memoryCache.data;
  const fresh = readCacheFile();
  if (fresh) memoryCache = { data: fresh, readAt: now };
  return fresh;
}

function saveCache(cache: ArenaAgentCache): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error('[arena-agent-leaderboard] Failed to write cache:', e);
  }
  memoryCache = { data: cache, readAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/*  Fetch fresh data from HuggingFace Dataset Server API               */
/* ------------------------------------------------------------------ */
async function fetchFromHfApi(): Promise<ArenaAgentCache | null> {
  try {
    const rows = await fetchHfDatasetRows('agent', 'latest', {
      concurrency: 3,
      timeout: 20000,
    });

    // Filter to "overall" category
    const overallRows = rows.filter(
      (r) => r.category === 'overall'
    ) as Array<{
      model_name: string;
      organization: string;
      license: string;
      score: number;
      score_ci_lower: number;
      score_ci_upper: number;
      observation_count: number;
      session_count: number;
      rank: number;
    }>;

    if (overallRows.length === 0) return null;

    // Sort by rank
    overallRows.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

    const models: ArenaAgentModel[] = overallRows.map((r) => {
      // Agent scores are percentages (0-1), convert to 0-100
      const scorePct = (r.score || 0) * 100;
      const ciLowerPct = (r.score_ci_lower || 0) * 100;
      const ciUpperPct = (r.score_ci_upper || 0) * 100;
      const ci = (ciUpperPct - ciLowerPct) / 2;

      return {
        rank: Math.round(r.rank),
        rank_lower: Math.round(r.rank),
        rank_upper: Math.round(r.rank),
        model_key: r.model_name.replace(/\s+/g, '-').toLowerCase(),
        name: r.model_name,
        organization: r.organization || '',
        license: r.license || '',
        net_improvement: Math.round(scorePct * 10) / 10,
        net_improvement_ci: Math.round(ci * 10) / 10,
        confirmed_success: 0,
        confirmed_success_ci: 0,
        praise_vs_complaint: 0,
        praise_vs_complaint_ci: 0,
        steerability: 0,
        steerability_ci: 0,
        bash_recovery: 0,
        bash_recovery_ci: 0,
        tool_hallucination: 0,
        tool_hallucination_ci: 0,
        sessions: Math.round(r.session_count || 0),
        cost_per_task: 0,
        output_tokens: 0,
        input_price: null,
        output_price: null,
        url: 'https://arena.ai/leaderboard/agent',
        context: null,
      };
    });

    const cache: ArenaAgentCache = {
      fetchedAt: new Date().toISOString(),
      source: 'HuggingFace Dataset API (lmarena-ai/leaderboard-dataset)',
      sourceUrl: 'https://arena.ai/leaderboard/agent',
      methodology: 'https://arena.ai/leaderboard/agent',
      totalModels: models.length,
      models,
    };

    saveCache(cache);
    return cache;
  } catch (e) {
    console.error('[arena-agent-leaderboard] HF API fetch failed:', e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/arena-agent-leaderboard                                   */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  // 1. Try fresh data from HuggingFace Dataset Server API
  const fresh = await fetchFromHfApi();

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
