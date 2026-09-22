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
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as ArenaAgentCache;
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
/*  Fresh data fetch (disabled — SDK crashes in some environments)     */
/* ------------------------------------------------------------------ */
async function tryFetchOnce(): Promise<ArenaAgentCache | null> {
  // The z-ai SDK page_reader is unstable in serverless/edge environments.
  // Data is kept fresh via the static fallback file (src/data/arena-agent-fallback.json)
  // which should be updated periodically via GitHub Actions cron.
  return null;
}

/**
 * Parse the rendered HTML from arena.ai/leaderboard/agent to extract rows.
 */
function parseArenaAgentHtml(html: string): ArenaAgentCache | null {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const models: ArenaAgentModel[] = [];
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

    const rankParts = cells[0].split(/\s+/).map(Number);
    const rank = rankParts[0];
    if (!rank) continue;
    const rank_lower = rankParts[1] || rank;
    const rank_upper = rankParts[2] || rank;

    const modelStr = cells[1];
    let name = modelStr;
    let organization = '';
    let licenseStr = '';
    const orgs = ['OpenAI','Anthropic','Google DeepMind','Google','Meta','Mistral','DeepSeek','Cohere','xAI','Reka','Qwen','Alibaba','Microsoft','NVIDIA','Amazon','01.AI','Yi','Zhipu','Perplexity','Fireworks','Together','Snowflake','Databricks','IBM','Writer','Aleph','LMSYS','SambaNova'];
    for (const org of orgs) {
      const idx = modelStr.lastIndexOf(org);
      if (idx > 0) {
        name = modelStr.substring(0, idx).trim();
        const rest = modelStr.substring(idx + org.length).trim();
        const licMatch = rest.match(/^·\s*(.+)$/);
        organization = org;
        licenseStr = licMatch ? licMatch[1].trim() : rest.replace(/^·\s*/, '').trim();
        break;
      }
    }

    function parsePercent(str: string) {
      const m = str.match(/([\d.]+)\s*%\s*±([\d.]+)%/);
      if (m) return { value: parseFloat(m[1]), ci: parseFloat(m[2]) };
      const m2 = str.match(/([\d.]+)\s*%/);
      if (m2) return { value: parseFloat(m2[1]), ci: 0 };
      return { value: 0, ci: 0 };
    }

    const net_improvement = parsePercent(cells[2] || '');
    const confirmed_success = parsePercent(cells[3] || '');
    const praise_vs_complaint = parsePercent(cells[4] || '');
    const steerability = parsePercent(cells[5] || '');
    const bash_recovery = parsePercent(cells[6] || '');
    const tool_hallucination = parsePercent(cells[7] || '');

    const sessions = parseInt((cells[8] || '0').replace(/,/g, '')) || 0;
    const cost_per_task = parseFloat((cells[9] || '').replace(/[^0-9.]/g, '')) || 0;

    const outputTokensStr = cells[10] || '';
    let output_tokens = 0;
    if (outputTokensStr.includes('K')) output_tokens = parseFloat(outputTokensStr.replace(/[^0-9.K]/g, '')) * 1000;
    else if (outputTokensStr.includes('M')) output_tokens = parseFloat(outputTokensStr.replace(/[^0-9.M]/g, '')) * 1000000;
    else output_tokens = parseInt(outputTokensStr.replace(/[^0-9]/g, '')) || 0;

    const priceStr = cells[11] || '';
    const priceMatch = priceStr.match(/\\\$?([\d.]+)\s*\/\s*\\\$?([\d.]+)/);
    const input_price = priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : null;
    const output_price = priceMatch ? Math.round(parseFloat(priceMatch[2]) * 100) : null;

    models.push({
      rank, rank_lower, rank_upper,
      model_key: name.replace(/\s+/g, '-').toLowerCase(),
      name, organization, license: licenseStr,
      net_improvement: net_improvement.value,
      net_improvement_ci: net_improvement.ci,
      confirmed_success: confirmed_success.value,
      confirmed_success_ci: confirmed_success.ci,
      praise_vs_complaint: praise_vs_complaint.value,
      praise_vs_complaint_ci: praise_vs_complaint.ci,
      steerability: steerability.value,
      steerability_ci: steerability.ci,
      bash_recovery: bash_recovery.value,
      bash_recovery_ci: bash_recovery.ci,
      tool_hallucination: tool_hallucination.value,
      tool_hallucination_ci: tool_hallucination.ci,
      sessions, cost_per_task, output_tokens,
      input_price, output_price,
      url: 'https://arena.ai/leaderboard/agent',
      context: null,
    });
  }

  if (models.length === 0) return null;

  const cache: ArenaAgentCache = {
    fetchedAt: new Date().toISOString(),
    source: 'arena.ai (LMArena Agent)',
    sourceUrl: 'https://arena.ai/leaderboard/agent',
    methodology: 'https://arena.ai/leaderboard/agent',
    totalModels: models.length,
    models,
  };

  saveCache(cache);
  return cache;
}

/* ------------------------------------------------------------------ */
/*  GET /api/arena-agent-leaderboard                                   */
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
