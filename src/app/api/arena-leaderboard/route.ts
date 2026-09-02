import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface LeaderboardModel {
  rank: number;
  model_id: string;
  name: string;
  organization: string;
  organization_id: string;
  country: string | null;
  score: number | null;
  input_price: number | null;
  output_price: number | null;
  context: number | null;
  multimodal: boolean;
  url: string;
}

interface LeaderboardCache {
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  methodology: string;
  totalModelsExtracted: number;
  modelsRanked: number;
  models: LeaderboardModel[];
}

/* ------------------------------------------------------------------ */
/*  Static fallback (bundled with the app, always available)           */
/* ------------------------------------------------------------------ */
import fallbackData from '@/data/leaderboard-fallback.json';
const STATIC_FALLBACK: LeaderboardCache = fallbackData as LeaderboardCache;

/* ------------------------------------------------------------------ */
/*  Cache — uses /tmp on Vercel, data/ locally                        */
/* ------------------------------------------------------------------ */
const CACHE_DIR = process.env.VERCEL ? join(tmpdir(), 'newsshore') : join(process.cwd(), 'data');
const CACHE_PATH = join(CACHE_DIR, 'leaderboard-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let memoryCache: { data: LeaderboardCache; readAt: number } | null = null;

function readCacheFile(): LeaderboardCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as LeaderboardCache;
  } catch {
    return null;
  }
}

function getCache(): LeaderboardCache | null {
  const now = Date.now();
  if (memoryCache && now - memoryCache.readAt < CACHE_TTL_MS) {
    return memoryCache.data;
  }
  const fresh = readCacheFile();
  if (fresh) {
    memoryCache = { data: fresh, readAt: now };
  }
  return fresh;
}

/* ------------------------------------------------------------------ */
/*  Fetch fresh data from llm-stats.com                               */
/* ------------------------------------------------------------------ */
async function fetchFreshData(): Promise<LeaderboardCache | null> {
  // External fetch disabled for stability.
  // Data is kept fresh via the static fallback file (src/data/leaderboard-fallback.json).
  return null;
}

/**
 * Parse the RSC payload embedded in llm-stats.com HTML page.
 */
function parseHtmlToCache(html: string): LeaderboardCache | null {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g);
  if (!scripts) return null;

  for (const script of scripts) {
    if (!script.includes('initialData')) continue;

    const pushStart = script.indexOf('[1,"');
    if (pushStart === -1) continue;

    let actual = script.substring(pushStart + 4);

    const end = actual.lastIndexOf('\\n"])');
    if (end === -1) continue;
    actual = actual.substring(0, end);

    const ESC = '\x00ESC\x00';
    actual = actual.split('\\\\"').join(ESC);
    actual = actual.split('\\"').join('"');
    actual = actual.split(ESC).join('\\"');
    actual = actual.split('\\n').join('\n');

    const dataIdx = actual.indexOf('initialData');
    if (dataIdx === -1) continue;
    const arrStart = actual.indexOf('[{', dataIdx);
    if (arrStart === -1) continue;

    let depth = 0;
    let i = arrStart;
    while (i < actual.length) {
      if (actual[i] === '[') depth++;
      else if (actual[i] === ']') depth--;
      if (depth === 0) break;
      i++;
    }

    let rawModels: Record<string, unknown>[];
    try {
      rawModels = JSON.parse(actual.substring(arrStart, i + 1));
    } catch (parseErr) {
      console.error('[leaderboard] JSON parse error:', parseErr);
      continue;
    }

    const ranked = [...rawModels].sort((a, b) => {
      const aS = (a.index_general as number) ?? 0;
      const bS = (b.index_general as number) ?? 0;
      if ((a.index_general != null) !== (b.index_general != null)) {
        return a.index_general != null ? -1 : 1;
      }
      return bS - aS;
    });

    const models: LeaderboardModel[] = ranked.map((m, j) => ({
      rank: j + 1,
      model_id: (m.model_id as string) ?? '',
      name: (m.name as string) ?? '',
      organization: (m.organization as string) ?? '',
      organization_id: (m.organization_id as string) ?? '',
      country: (m.organization_country as string) ?? null,
      score: (m.index_general as number) ?? null,
      input_price: (m.input_price as number) ?? null,
      output_price: (m.output_price as number) ?? null,
      context: (m.context as number) ?? null,
      multimodal: (m.multimodal as boolean) ?? false,
      url: 'https://llm-stats.com/models/' + ((m.model_id as string) ?? ''),
    }));

    const cache: LeaderboardCache = {
      fetchedAt: new Date().toISOString(),
      source: 'llm-stats.com',
      sourceUrl: 'https://llm-stats.com/leaderboards/llm-leaderboard',
      methodology: 'https://llm-stats.com/methodology/llm-stats-score',
      totalModelsExtracted: rawModels.length,
      modelsRanked: models.length,
      models,
    };

    try {
      if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    } catch (e) {
      console.error('[leaderboard] Failed to write cache:', e);
    }

    memoryCache = { data: cache, readAt: Date.now() };
    return cache;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  GET /api/leaderboard                                               */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  // 1. Try fresh data from llm-stats.com
  const fresh = await fetchFreshData();

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
    totalModels: cache.modelsRanked,
    returnedModels: models.length,
    models,
  });
}
