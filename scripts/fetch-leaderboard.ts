/**
 * Fetch Leaderboard Script
 * Fetches AI model leaderboard data from llm-stats.com (via api.zeroeval.com)
 * and saves it to data/leaderboard-cache.json
 *
 * Usage: bun run scripts/fetch-leaderboard.ts
 *
 * Data source: LLM Stats (llm-stats.com) — tracks 300+ models with daily-updated
 * benchmark and pricing data. Models are ranked by the LLM Stats Score (index_general),
 * a composite metric aggregated from public benchmarks and live API metrics.
 *
 * See: https://llm-stats.com/methodology/llm-stats-score
 */

const LEADERBOARD_URL = 'https://llm-stats.com/leaderboards/llm-leaderboard';
const CACHE_FILE = 'data/leaderboard-cache.json';

interface RawModel {
  model_id: string;
  name: string;
  organization: string;
  organization_id: string;
  organization_country: string | null;
  params: number | null;
  training_tokens: number | null;
  context: number | null;
  release_date: string | null;
  announcement_date: string | null;
  multimodal: boolean | null;
  license: string | null;
  is_moe: boolean | null;
  knowledge_cutoff: string | null;
  input_price: number | null;  // cents per million tokens
  output_price: number | null; // cents per million tokens
  throughput: number | null;
  latency: number | null;
  // Benchmark scores
  gpqa_score: number | null;
  hle_score: number | null;
  swe_bench_verified_score: number | null;
  coding_arena_score: number | null;
  // Index scores (category composites)
  index_general: number | null;  // The primary LLM Stats Score
  index_reasoning: number | null;
  index_math: number | null;
  index_code: number | null;
  index_search: number | null;
  index_communication: number | null;
  index_vision: number | null;
  index_tool_calling: number | null;
  index_long_context: number | null;
  index_finance: number | null;
  index_legal: number | null;
  index_healthcare: number | null;
  [key: string]: unknown;
}

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

/**
 * Build the official model page URL.
 * Falls back to llm-stats.com model page for models without a direct official link.
 */
function getModelUrl(model: RawModel): string {
  const slug = model.model_id;
  // Primary: llm-stats.com model page (reliable, exists for every model)
  return `https://llm-stats.com/models/${slug}`;
}

/**
 * Parse the Next.js RSC payload from the leaderboard HTML page
 * to extract the initialData array of models.
 */
function extractModelsFromHtml(html: string): RawModel[] {
  // The page uses React Server Components with self.__next_f.push([1,"..."])
  // The model data is embedded in a script tag containing initialData
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (!scripts) return [];

  for (const script of scripts) {
    const idx = script.indexOf('initialData');
    if (idx === -1) continue;

    // Find the RSC push boundary
    const pushStart = script.indexOf('[1,"');
    if (pushStart === -1) continue;

    let actual = script.substring(pushStart + 4);
    const end = actual.lastIndexOf('"\"]');
    if (end === -1) continue;
    actual = actual.substring(0, end);

    // Unescape the JSON string (RSC encoding)
    actual = actual.replace(/\\"/g, '\x00'); // escaped quotes
    actual = actual.replace(/\\\\/g, '\\');
    actual = actual.replace(/\x00/g, '"');
    actual = actual.replace(/\\n/g, '\n');

    // Find the initialData array
    const dataIdx = actual.indexOf('initialData');
    const arrStart = actual.indexOf('[{', dataIdx);
    if (arrStart === -1) continue;

    // Count brackets to find matching close
    let depth = 0;
    let i = arrStart;
    while (i < actual.length) {
      if (actual[i] === '[') depth++;
      else if (actual[i] === ']') depth--;
      if (depth === 0) break;
      i++;
    }

    const modelData = actual.substring(arrStart, i + 1);
    try {
      return JSON.parse(modelData) as RawModel[];
    } catch (e) {
      console.error('Failed to parse model data:', e);
      continue;
    }
  }

  return [];
}

/**
 * Format price from cents/M tokens to human-readable string
 */
function formatPrice(centsPerMillion: number | null): string {
  if (centsPerMillion === null) return 'N/A';
  return `$${(centsPerMillion / 100).toFixed(2)}/M tok`;
}

async function fetchLeaderboard(): Promise<void> {
  console.log(`Fetching leaderboard from ${LEADERBOARD_URL}...`);

  const response = await fetch(LEADERBOARD_URL, {
    headers: {
      'User-Agent': 'NewsShore-Bot/1.0 (https://newsshore.com)',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  console.log(`Downloaded HTML: ${(html.length / 1024).toFixed(0)} KB`);

  const rawModels = extractModelsFromHtml(html);
  console.log(`Extracted ${rawModels.length} models from page`);

  if (rawModels.length === 0) {
    throw new Error('No models found in page data. The page structure may have changed.');
  }

  // Sort by index_general (LLM Stats Score) descending, nulls last
  const ranked = [...rawModels].sort((a, b) => {
    const aScore = a.index_general ?? 0;
    const bScore = b.index_general ?? 0;
    const aHas = a.index_general !== null;
    const bHas = b.index_general !== null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return bScore - aScore;
  });

  // Transform to our interface
  const models: LeaderboardModel[] = ranked.map((m, i) => ({
    rank: i + 1,
    model_id: m.model_id,
    name: m.name,
    organization: m.organization,
    organization_id: m.organization_id,
    country: m.organization_country,
    score: m.index_general,
    input_price: m.input_price,
    output_price: m.output_price,
    context: m.context,
    multimodal: m.multimodal ?? false,
    url: getModelUrl(m),
  }));

  // Build cache object
  const cache = {
    fetchedAt: new Date().toISOString(),
    source: 'llm-stats.com',
    sourceUrl: LEADERBOARD_URL,
    methodology: 'https://llm-stats.com/methodology/llm-stats-score',
    totalModelsExtracted: rawModels.length,
    modelsRanked: models.length,
    models: models,
  };

  // Save to cache file
  const fs = await import('fs');
  const path = await import('path');
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  console.log(`\nLeaderboard cache saved to ${CACHE_FILE}`);
  console.log(`  Total models on llm-stats: ${rawModels.length}`);
  console.log(`  Models with scores (ranked): ${models.length}`);
  console.log(`\nTop 5:`);
  for (const m of models.slice(0, 5)) {
    const price = m.input_price !== null
      ? `$${(m.input_price / 100).toFixed(2)}/$${(m.output_price! / 100).toFixed(2)} per M tok`
      : 'No pricing';
    console.log(`  #${m.rank} ${m.name} (${m.organization}) — score: ${m.score} — ${price}`);
  }
}

// Run
fetchLeaderboard().catch((err) => {
  console.error('Failed to fetch leaderboard:', err);
  process.exit(1);
});
