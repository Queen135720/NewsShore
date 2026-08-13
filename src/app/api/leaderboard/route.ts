import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  input_price: number | null;   // cents per million tokens
  output_price: number | null;  // cents per million tokens
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
/*  In-memory cache (refreshed on each request if stale)               */
/* ------------------------------------------------------------------ */
const CACHE_PATH = join(process.cwd(), 'data', 'leaderboard-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — keeps leaderboard current
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
  try {
    const res = await fetch('https://llm-stats.com/leaderboards/llm-leaderboard', {
      headers: {
        'User-Agent': 'NewsShore-Bot/1.0 (https://newsshore.com)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseHtmlToCache(html);
  } catch (err) {
    console.error('[leaderboard] Failed to fetch fresh data:', err);
    return null;
  }
}

/**
 * Parse the RSC (React Server Components) payload embedded in the
 * llm-stats.com HTML page.  The data lives inside a `<script>` tag
 * that starts with `[1,"` and ends with `\n"])`.  Inside, model
 * records appear as a JSON array keyed by `initialData`.
 */
function parseHtmlToCache(html: string): LeaderboardCache | null {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g);
  if (!scripts) return null;

  for (const script of scripts) {
    if (!script.includes('initialData')) continue;

    const pushStart = script.indexOf('[1,"');
    if (pushStart === -1) continue;

    let actual = script.substring(pushStart + 4);

    /* --- Find the correct end of the RSC payload --- */
    // The payload ends with the literal characters: \n"])  
    // In the raw HTML these are 6 chars: backslash backslash n " ] )
    const end = actual.lastIndexOf('\\n"])');
    if (end === -1) continue;
    actual = actual.substring(0, end);

    /* --- Unescape RSC JSON (order matters) --- */
    // 1. Protect already-escaped-backslash-quote (\\") from step 2
    const ESC = '\x00ESC\x00';
    actual = actual.split('\\\\"').join(ESC);
    // 2. Unescape regular escaped quotes (\"  →  ")
    actual = actual.split('\\"').join('"');
    // 3. Restore protected sequences (\\")
    actual = actual.split(ESC).join('\\"');
    // 4. Unescape newlines
    actual = actual.split('\\n').join('\n');

    /* --- Locate the model array inside the payload --- */
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

    // Sort by index_general (LLM Stats Score) descending
    const ranked = [...rawModels].sort((a, b) => {
      const aS = (a.index_general as number) ?? 0;
      const bS = (b.index_general as number) ?? 0;
      // Models with scores come before those without
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

    // Persist to disk
    try {
      const dir = join(process.cwd(), 'data');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 337);

  // Always try fresh data first, fall back to static cache
  const fresh = await fetchFreshData();
  let cache = fresh || getCache();

  if (!cache) {
    return NextResponse.json(
      { error: 'Leaderboard data unavailable. Please try again later.' },
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
    totalModels: cache.modelsRanked,
    returnedModels: models.length,
    models,
  });
}
