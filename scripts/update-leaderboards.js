#!/usr/bin/env node
/**
 * update-leaderboards.js
 * Fetches fresh leaderboard data from arena.ai and llm-stats.com
 * using the z-ai-web-dev-sdk CLI, then updates the JSON fallback files.
 *
 * Usage:
 *   node scripts/update-leaderboards.js          # fetch all
 *   node scripts/update-leaderboards.js arena     # fetch chat arena only
 *   node scripts/update-leaderboards.js agent     # fetch agent arena only
 *   node scripts/update-leaderboards.js benchmarks # fetch benchmarks only
 *
 * Designed to run in GitHub Actions CI on a cron schedule.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const ARENA_OUT = path.join(DATA_DIR, 'arena-fallback.json');
const ARENA_AGENT_OUT = path.join(DATA_DIR, 'arena-agent-fallback.json');
const LLMSTATS_OUT = path.join(DATA_DIR, 'leaderboard-fallback.json');
const CLI = 'z-ai';

const which = (process.argv[2] || 'all').toLowerCase();
const doArena = which === 'arena' || which === 'all';
const doAgent = which === 'agent' || which === 'all';
const doBench = which === 'benchmarks' || which === 'all';

/* ── Arena.ai parser ─────────────────────────────────────────── */
function parseArenaHtml(html) {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const models = [];
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and normalize whitespace
      cells.push(cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    if (cells.length < 5) continue;

    const rankMatch = cells[0].match(/^(\d+)/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1]);

    const rangeParts = cells[1].trim().split(/\s+/).map(Number);
    const rank_lower = rangeParts[0] || rank;
    const rank_upper = rangeParts[1] || rank;

    // Name cell format: "Anthropic claude-fable-5-high Anthropic · Proprietary"
    // Extract model name (the hyphenated model key) and organization
    const nameCell = cells[2];
    let name = '', org = '', license = 'Proprietary';

    // Split by ' · ' to separate license
    const licParts = nameCell.split(' · ');
    if (licParts.length >= 2) {
      license = licParts[licParts.length - 1].trim();
    }
    const namePart = licParts.slice(0, -1).join(' · ').trim();

    // Try to find the model key (hyphenated identifier)
    const modelKeyMatch = namePart.match(/((?:claude|gpt|gemini|deepseek|llama|qwen|mistral|command|o1|o3|o4|reka|yi|grok|phi|internlm|mixtral|solar|dbrx|starcoder|codestral|jamba|nemotron|falcon|zephyr|openchat|vicuna|wizardlm|chatglm|c4ai|ryzen|smollm|ambrosio|fable|mythos|spark|astra|muse)[\w.(+ )-]+)/i);
    if (modelKeyMatch) {
      name = modelKeyMatch[1].trim();
      // Org is text before the model key
      const beforeKey = namePart.substring(0, modelKeyMatch.index).trim();
      if (beforeKey) org = beforeKey;
    } else {
      // Fallback: try splitting by known orgs
      const knownOrgs = ['OpenAI','Anthropic','Google','Meta','Mistral','DeepSeek','Cohere','xAI','Reka','Alibaba','Microsoft','NVIDIA','Amazon','01.AI','Zhipu','Perplexity','Snowflake','Databricks','IBM','Writer','SambaNova','Together','Fireworks'];
      for (const knownOrg of knownOrgs) {
        const idx = namePart.lastIndexOf(knownOrg);
        if (idx > 0) {
          name = namePart.substring(0, idx).trim();
          org = knownOrg;
          break;
        }
      }
      if (!name) name = namePart;
    }
    if (!name) continue;

    const scoreParts = cells[3].trim();
    const scoreMatch = scoreParts.match(/(\d{4})/);
    const ciMatch = scoreParts.match(/±(\d+)/);
    if (!scoreMatch) continue;
    const score = parseInt(scoreMatch[1]);
    const ci = ciMatch ? parseInt(ciMatch[1]) : 5;
    const votes = parseInt(cells[4].replace(/,/g, '').trim()) || 0;

    const priceStr = (cells[5] || '').trim();
    const priceMatch = priceStr.match(/\$(\d+)/g);
    let input_price = null, output_price = null;
    if (priceMatch && priceMatch.length >= 2) {
      input_price = parseInt(priceMatch[0].replace('$', '')) * 100;
      output_price = parseInt(priceMatch[1].replace('$', '')) * 100;
    }

    const ctxStr = (cells[6] || '').trim();
    let context = null;
    if (ctxStr.includes('M')) context = parseInt(ctxStr) * 1000000;
    else if (ctxStr.includes('K')) context = parseInt(ctxStr) * 1000;

    models.push({
      rank, rank_lower, rank_upper, model_key: name, name,
      arena_score: score, ci_lower: score - ci, ci_upper: score + ci,
      votes, organization: org, url: 'https://arena.ai/leaderboard/text',
      license: license || 'Proprietary', input_price, output_price, context,
    });
  }
  return models;
}

/* ── Arena.ai Agent parser ─────────────────────────────────────── */
function parseArenaAgentHtml(html) {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const models = [];
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    }
    if (cells.length < 5) continue;

    const rankParts = cells[0].split(/\s+/).map(Number);
    const rank = rankParts[0];
    if (!rank) continue;
    const rank_lower = rankParts[1] || rank;
    const rank_upper = rankParts[2] || rank;

    const modelStr = cells[1];
    let name = modelStr, organization = '', licenseStr = '';
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

    function parsePercent(str) {
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
  return models;
}

/* ── LLM-stats.com parser ────────────────────────────────────── */
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

/* ── Fetch + parse using z-ai CLI ─────────────────────────────── */
function fetchPage(url) {
  const tmpFile = `/tmp/leaderboard-fetch-${Date.now()}.json`;
  try {
    execSync(`${CLI} function -n page_reader -a '{"url":"${url}"}' -o ${tmpFile}`, {
      stdio: 'pipe', timeout: 120000,
    });
    const raw = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    if (raw?.code !== 200 || !raw?.data?.html) throw new Error('No HTML in response');
    return raw.data.html;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
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
      console.log('[arena] Fetching https://arena.ai/leaderboard/text ...');
      const html = fetchPage('https://arena.ai/leaderboard/text');
      const models = parseArenaHtml(html);
      if (models.length === 0) throw new Error('No models parsed from HTML');
      const cache = {
        fetchedAt: new Date().toISOString(),
        source: 'arena.ai (LMArena)',
        sourceUrl: 'https://arena.ai/leaderboard/text',
        methodology: 'https://arena.ai/leaderboard/text',
        totalModels: models.length,
        models,
      };
      fs.writeFileSync(ARENA_OUT, JSON.stringify(cache, null, 2));
      console.log(`[arena] ✅ Saved ${models.length} models to ${ARENA_OUT}`);
      console.log(`[arena] Top 3: ${models.slice(0, 3).map(m => m.name).join(', ')}`);
    } catch (e) {
      console.error('[arena] ❌ Failed:', e.message);
    }
  }

  if (doAgent) {
    try {
      console.log('\n[agent] Fetching https://arena.ai/leaderboard/agent ...');
      const html = fetchPage('https://arena.ai/leaderboard/agent');
      const models = parseArenaAgentHtml(html);
      if (models.length === 0) throw new Error('No models parsed from HTML');
      const cache = {
        fetchedAt: new Date().toISOString(),
        source: 'arena.ai (LMArena Agent)',
        sourceUrl: 'https://arena.ai/leaderboard/agent',
        methodology: 'https://arena.ai/leaderboard/agent',
        totalModels: models.length,
        models,
      };
      fs.writeFileSync(ARENA_AGENT_OUT, JSON.stringify(cache, null, 2));
      console.log(`[agent] ✅ Saved ${models.length} models to ${ARENA_AGENT_OUT}`);
      console.log(`[agent] Top 3: ${models.slice(0, 3).map(m => m.name).join(', ')}`);
    } catch (e) {
      console.error('[agent] ❌ Failed:', e.message);
    }
  }

  if (doBench) {
    try {
      console.log('\n[bench] Fetching https://llm-stats.com/leaderboards/llm-leaderboard ...');
      const html = fetchPage('https://llm-stats.com/leaderboards/llm-leaderboard');
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
