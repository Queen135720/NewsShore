#!/usr/bin/env node
/**
 * update-leaderboards.js
 * Fetches fresh leaderboard data from official sources:
 *   - Arena & Agent: HuggingFace Dataset Server API (lmarena-ai/leaderboard-dataset)
 *   - Benchmarks: llm-stats.com (server-rendered HTML with embedded JSON)
 *
 * Usage:
 *   node scripts/update-leaderboards.js          # fetch all
 *   node scripts/update-leaderboards.js arena     # fetch chat arena only
 *   node scripts/update-leaderboards.js agent     # fetch agent arena only
 *   node scripts/update-leaderboards.js benchmarks # fetch benchmarks only
 *
 * Designed to run in GitHub Actions CI on a cron schedule.
 * No special tools required — only Node.js built-in fetch.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const ARENA_OUT = path.join(DATA_DIR, 'arena-fallback.json');
const ARENA_AGENT_OUT = path.join(DATA_DIR, 'arena-agent-fallback.json');
const LLMSTATS_OUT = path.join(DATA_DIR, 'leaderboard-fallback.json');

const which = (process.argv[2] || 'all').toLowerCase();
const doArena = which === 'arena' || which === 'all';
const doAgent = which === 'agent' || which === 'all';
const doBench = which === 'benchmarks' || which === 'all';

/* ── HuggingFace Dataset Server API ───────────────────────────── */

const HF_BASE = 'https://datasets-server.huggingface.co';
const HF_DATASET = 'lmarena-ai/leaderboard-dataset';

function hfRowsUrl(config, split, offset, length) {
  return `${HF_BASE}/rows?dataset=${encodeURIComponent(HF_DATASET)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${length}`;
}

/**
 * Fetch rows from HuggingFace Dataset Server API with concurrent pagination.
 * For text config: stops early once non-"overall" categories appear (we only need overall).
 * For other configs: fetches all rows.
 */
async function fetchHfRows(config, split = 'latest', pageSize = 100) {
  const allRows = [];
  const CONCURRENCY = 5;

  // First request to get initial data and estimate total pages
  const firstUrl = hfRowsUrl(config, split, 0, pageSize);
  console.log(`  Fetching page 0 ...`);

  const firstRes = await fetch(firstUrl);
  if (!firstRes.ok) {
    throw new Error(`HF API returned ${firstRes.status}: ${await firstRes.text().catch(() => '')}`);
  }
  const firstData = await firstRes.json();
  if (!firstData.rows || firstData.rows.length === 0) {
    return allRows;
  }

  for (const row of firstData.rows) {
    allRows.push(row.row);
  }
  console.log(`  Got ${firstData.rows.length} rows`);

  // If first page had fewer than pageSize, that's all the data
  if (firstData.rows.length < pageSize) {
    return allRows;
  }

  // For text config: check if we already have all "overall" rows
  // The data is sorted by category with "overall" first, so once we
  // see a non-"overall" category, we can stop.
  if (config === 'text') {
    const lastRow = firstData.rows[firstData.rows.length - 1].row;
    if (lastRow.category !== 'overall') {
      // Filter to overall only and return
      return allRows.filter(r => r.category === 'overall');
    }
  }

  // Fetch remaining pages concurrently in batches
  let offset = pageSize;
  let batchNum = 1;
  let done = false;

  while (!done) {
    // Build batch of page offsets to fetch concurrently
    const batchOffsets = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      batchOffsets.push(offset + i * pageSize);
    }

    console.log(`  Fetching pages ${batchOffsets[0]/pageSize}-${batchOffsets[batchOffsets.length-1]/pageSize} (batch ${batchNum}) ...`);

    const results = await Promise.all(
      batchOffsets.map(async (o) => {
        try {
          const res = await fetch(hfRowsUrl(config, split, o, pageSize));
          if (!res.ok) return { rows: [] };
          const data = await res.json();
          return data;
        } catch {
          return { rows: [] };
        }
      })
    );

    let batchRows = 0;
    let hitNonOverall = false;

    for (const data of results) {
      if (!data.rows || data.rows.length === 0) {
        done = true;
        continue;
      }

      for (const row of data.rows) {
        // For text config: stop once we pass "overall" category
        if (config === 'text' && row.row.category !== 'overall') {
          hitNonOverall = true;
          continue;
        }
        allRows.push(row.row);
      }

      batchRows += data.rows.length;

      // If page returned fewer than pageSize, we've reached the end
      if (data.rows.length < pageSize) {
        done = true;
      }
    }

    console.log(`  Got ${batchRows} rows in batch ${batchNum} (total: ${allRows.length})`);

    if (hitNonOverall) {
      console.log(`  Stopped at non-"overall" category — have all arena models`);
      done = true;
    }

    offset += CONCURRENCY * pageSize;
    batchNum++;
  }

  return allRows;
}

/* ── Arena (Text) via HF Dataset API ─────────────────────────── */

function transformArenaRows(rows) {
  // Ensure we only have "overall" category (safety filter)
  const overallRows = rows.filter(r => r.category === 'overall');

  // Sort by rank
  overallRows.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

  return overallRows.map(r => ({
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
}

/* ── Agent via HF Dataset API ────────────────────────────────── */

function transformAgentRows(rows) {
  // Filter to "overall" category and sort by rank
  const overallRows = rows.filter(r => r.category === 'overall');
  overallRows.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

  return overallRows.map(r => {
    // Agent scores are percentages (0-1), convert to 0-100 for display
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
      // The "score" in agent is net_improvement percentage
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
      arena_score: Math.round(scorePct * 10) / 10,
      votes: Math.round(r.observation_count || 0),
    };
  });
}

/* ── LLM-stats.com parser (server-rendered HTML) ─────────────── */

function parseLlmStatsHtml(html) {
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
    let depth = 0, i = arrStart;
    while (i < actual.length) { if (actual[i] === '[') depth++; else if (actual[i] === ']') depth--; if (depth === 0) break; i++; }
    let rawModels;
    try { rawModels = JSON.parse(actual.substring(arrStart, i + 1)); } catch { continue; }

    const ranked = [...rawModels].sort((a, b) => {
      const aS = (a.index_general ?? 0), bS = (b.index_general ?? 0);
      if ((a.index_general != null) !== (b.index_general != null)) return a.index_general != null ? -1 : 1;
      return bS - aS;
    });

    return ranked.map((m, j) => ({
      rank: j + 1, model_id: m.model_id ?? '', name: m.name ?? '',
      organization: m.organization ?? '', organization_id: m.organization_id ?? '',
      country: m.organization_country ?? null, score: m.index_general ?? null,
      input_price: m.input_price ?? null, output_price: m.output_price ?? null,
      context: m.context ?? null, multimodal: m.multimodal ?? false,
      url: 'https://llm-stats.com/models/' + (m.model_id ?? ''),
    }));
  }
  return null;
}

/* ── Fetch HTML (for llm-stats.com) ──────────────────────────── */

async function fetchHtml(url) {
  console.log(`  Fetching ${url} ...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsShore-Leaderboard-Updater/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ── Main ─────────────────────────────────────────────────────── */

async function main() {
  console.log('=== Leaderboard Data Updater ===');
  console.log('Time:', new Date().toISOString());
  console.log('Mode:', which, '\n');

  // Ensure output directory exists
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (doArena) {
    try {
      console.log('[arena] Fetching from HuggingFace Dataset API (text/latest) ...');
      const rows = await fetchHfRows('text', 'latest', 100);
      if (rows.length === 0) throw new Error('No rows returned from HF API');
      const models = transformArenaRows(rows);
      if (models.length === 0) throw new Error('No models after transformation');
      const cache = {
        fetchedAt: new Date().toISOString(),
        source: 'HuggingFace Dataset API (lmarena-ai/leaderboard-dataset, text/latest)',
        sourceUrl: 'https://arena.ai/leaderboard/text',
        methodology: 'https://arena.ai/leaderboard/text',
        totalModels: models.length,
        models,
      };
      fs.writeFileSync(ARENA_OUT, JSON.stringify(cache, null, 2));
      console.log(`[arena] ✅ Saved ${models.length} models to ${ARENA_OUT}`);
      console.log(`[arena] Top 3: ${models.slice(0, 3).map(m => `${m.name} (${m.arena_score})`).join(', ')}`);
    } catch (e) {
      console.error('[arena] ❌ Failed:', e.message);
    }
  }

  if (doAgent) {
    try {
      console.log('\n[agent] Fetching from HuggingFace Dataset API (agent/latest) ...');
      const rows = await fetchHfRows('agent', 'latest', 100);
      if (rows.length === 0) throw new Error('No rows returned from HF API');
      const models = transformAgentRows(rows);
      if (models.length === 0) throw new Error('No models after transformation');
      const cache = {
        fetchedAt: new Date().toISOString(),
        source: 'HuggingFace Dataset API (lmarena-ai/leaderboard-dataset, agent/latest)',
        sourceUrl: 'https://arena.ai/leaderboard/agent',
        methodology: 'https://arena.ai/leaderboard/agent',
        totalModels: models.length,
        models,
      };
      fs.writeFileSync(ARENA_AGENT_OUT, JSON.stringify(cache, null, 2));
      console.log(`[agent] ✅ Saved ${models.length} models to ${ARENA_AGENT_OUT}`);
      console.log(`[agent] Top 3: ${models.slice(0, 3).map(m => `${m.name} (score ${m.arena_score}%)`).join(', ')}`);
    } catch (e) {
      console.error('[agent] ❌ Failed:', e.message);
    }
  }

  if (doBench) {
    try {
      console.log('\n[bench] Fetching https://llm-stats.com/leaderboards/llm-leaderboard ...');
      const html = await fetchHtml('https://llm-stats.com/leaderboards/llm-leaderboard');
      const models = parseLlmStatsHtml(html);
      if (!models || models.length === 0) throw new Error('No models parsed from HTML');
      const cache = {
        fetchedAt: new Date().toISOString(),
        source: 'llm-stats.com',
        sourceUrl: 'https://llm-stats.com/leaderboards/llm-leaderboard',
        methodology: 'https://llm-stats.com/methodology/llm-stats-score',
        totalModelsExtracted: models.length,
        modelsRanked: models.length,
        models,
      };
      fs.writeFileSync(LLMSTATS_OUT, JSON.stringify(cache, null, 2));
      console.log(`[bench] ✅ Saved ${models.length} models to ${LLMSTATS_OUT}`);
      console.log(`[bench] Top 3: ${models.slice(0, 3).map(m => m.name).join(', ')}`);
    } catch (e) {
      console.error('[bench] ❌ Failed:', e.message);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
