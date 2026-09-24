/**
 * AI Model Leaderboard Types & Helpers
 *
 * Three independent ranking systems are used:
 *
 * 1. Benchmark Performance  →  llm-stats.com  (LLM Stats Score)
 *    Measures raw capability on standardized tests (coding, math, reasoning).
 *    Source: https://llm-stats.com/leaderboards/llm-leaderboard
 *
 * 2. Human Preference (Chat)  →  arena.ai / LMArena  (Bradley-Terry Arena Score)
 *    Measures which response real humans actually preferred in blind
 *    head-to-head comparisons.
 *    Source: https://arena.ai/leaderboard/text
 *
 * 3. Human Preference (Agent)  →  arena.ai / LMArena  (Agent Leaderboard)
 *    Measures tool use, planning, and multi-step reasoning in agentic tasks.
 *    Ranked by Net Improvement % from blind human evaluation.
 *    Source: https://arena.ai/leaderboard/agent
 */

/* ── LLM Stats (Benchmark) ─────────────────────────────────────── */

export interface AIModel {
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

export interface LeaderboardResponse {
  success: boolean;
  source: string;
  sourceUrl: string;
  methodology: string;
  fetchedAt: string;
  totalModels: number;
  returnedModels: number;
  models: AIModel[];
}

/* ── LMArena (Human Preference) ─────────────────────────────────── */

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

export interface ArenaLeaderboardResponse {
  success: boolean;
  source: string;
  sourceUrl: string;
  methodology: string;
  fetchedAt: string;
  totalModels: number;
  returnedModels: number;
  models: ArenaModel[];
}

/* ── LMArena (Agent Leaderboard) ──────────────────────────────────── */

export interface ArenaAgentModel {
  rank: number;
  rank_lower: number;
  rank_upper: number;
  model_key: string;
  name: string;
  organization: string;
  license: string;
  net_improvement: number;        // % of tasks where model improved over baseline
  net_improvement_ci: number;     // confidence interval half-width
  confirmed_success: number;      // % of tasks with confirmed success
  confirmed_success_ci: number;
  praise_vs_complaint: number;    // % net praise vs complaint from evaluators
  praise_vs_complaint_ci: number;
  steerability: number;           // % steerability / instruction-following
  steerability_ci: number;
  bash_recovery: number;          // % ability to recover from errors
  bash_recovery_ci: number;
  tool_hallucination: number;     // % tool hallucination rate (lower is better)
  tool_hallucination_ci: number;
  sessions: number;               // number of evaluation sessions
  cost_per_task: number;          // median cost per task ($)
  output_tokens: number;          // median output tokens per task
  input_price: number | null;     // cents per million tokens
  output_price: number | null;    // cents per million tokens
  context: number | null;
  url: string;
}

export interface ArenaAgentLeaderboardResponse {
  success: boolean;
  source: string;
  sourceUrl: string;
  methodology: string;
  fetchedAt: string;
  totalModels: number;
  returnedModels: number;
  models: ArenaAgentModel[];
}

/* ── Shared Helpers ─────────────────────────────────────────────── */

/** Format price from cents/M tokens to display string */
export function formatPrice(centsPerMillion: number | null): string {
  if (centsPerMillion === null) return 'N/A';
  const dollars = (centsPerMillion / 100).toFixed(2);
  return `$${dollars}/M tok`;
}

/** Format context window to display string */
export function formatContext(tokens: number | null): string {
  if (tokens === null) return '—';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

/** Format Arena CI (confidence interval) */
export function formatCI(ciLower: number, ciUpper: number): string {
  const half = ((ciUpper - ciLower) / 2).toFixed(1);
  return `±${half}`;
}

/**
 * Format a raw arena model key/name into a human-friendly display name
 * matching lmarena.ai's style.
 *
 * Examples:
 *   "claude-fable-5-high"   → "Claude Fable 5 High"
 *   "claude-opus-4-6-high"  → "Claude Opus 4-6 High"
 *   "gpt-4o"                → "GPT-4o"
 *   "gemini-2.5-pro"        → "Gemini 2.5 Pro"
 *   "deepseek-r1"           → "DeepSeek R1"
 *   "llama-3.1-405b"        → "Llama 3.1 405B"
 */
export function formatArenaModelName(raw: string): string {
  if (!raw) return '';

  // If the name already looks human-friendly (has spaces, mixed case), return as-is
  // e.g. "Anthropic Claude Fable 5.1 (Max)" from agent leaderboard
  if (/[A-Z][a-z]/.test(raw) && raw.includes(' ') && !raw.includes('-')) {
    return raw;
  }

  // Map of brand names with specific casing
  const BRAND_CASE: Record<string, string> = {
    'deepseek': 'DeepSeek',
    'openai': 'OpenAI',
    'xai': 'xAI',
    '01ai': '01.AI',
    'qwen': 'Qwen',
    'dbrx': 'DBRX',
    'smollm': 'SmolLM',
    'c4ai': 'C4AI',
    'ryzenai': 'RyzenAI',
    'internlm': 'InternLM',
    'chatglm': 'ChatGLM',
    'starcoder': 'StarCoder',
    'codestral': 'Codestral',
    'mixtral': 'Mixtral',
    'zephyr': 'Zephyr',
    'openchat': 'OpenChat',
    'vicuna': 'Vicuna',
    'wizardlm': 'WizardLM',
    'starling': 'Starling',
    'solar': 'SOLAR',
    'falcon': 'Falcon',
    'jamba': 'Jamba',
    'nemotron': 'Nemotron',
    'command': 'Command',
    'amber': 'Amber',
    'mythos': 'Mythos',
    'fable': 'Fable',
    'ambrosio': 'Ambrosio',
    'spark': 'Spark',
    'astra': 'Astra',
  };

  // Tier suffixes that should be capitalized as words
  const TIER_WORDS: Record<string, string> = {
    'high': 'High',
    'max': 'Max',
    'low': 'Low',
    'mid': 'Mid',
    'xhigh': 'XHigh',
    'text': 'Text',
    'base': 'Base',
    'chat': 'Chat',
    'instruct': 'Instruct',
    'reasoning': 'Reasoning',
    'preview': 'Preview',
    'beta': 'Beta',
  };

  // Prefixes that keep their hyphen with the version (e.g., "GPT-4o", "O1-mini")
  const HYPHEN_PREFIXES = new Set(['gpt', 'o1', 'o3', 'o4']);

  // Step 1: Split intelligently — keep hyphens between digits (e.g., "4-6" in "claude-opus-4-6-high")
  // and hyphens after HYPHEN_PREFIXES (e.g., "gpt-4o")
  const segments: string[] = [];
  const rawParts = raw.split('-');

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    const prevPart = i > 0 ? rawParts[i - 1] : '';

    // If previous part is a hyphen prefix (e.g., "gpt"), merge with hyphen
    if (HYPHEN_PREFIXES.has(prevPart.toLowerCase()) && segments.length > 0) {
      segments[segments.length - 1] = segments[segments.length - 1] + '-' + part;
      continue;
    }

    // If both this part and previous part are numeric, merge with hyphen (e.g., "4-6")
    if (/^\d+$/.test(part) && /^\d+$/.test(prevPart) && segments.length > 0) {
      segments[segments.length - 1] = segments[segments.length - 1] + '-' + part;
      continue;
    }

    segments.push(part);
  }

  // Step 2: Format each segment
  const formatted = segments.map((part) => {
    const lower = part.toLowerCase();

    // Check brand-specific casing first (for non-hyphenated segments)
    if (BRAND_CASE[lower]) return BRAND_CASE[lower];

    // Check tier words (e.g., "high" → "High")
    if (TIER_WORDS[lower]) return TIER_WORDS[lower];

    // Handle GPT-like prefixed segments (e.g., "gpt-4o" → "GPT-4o", "o1-mini" → "O1-mini")
    const prefixMatch = lower.match(/^(gpt|o[134])-(.+)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1].toUpperCase();
      const suffix = prefixMatch[2];
      // Keep suffix casing: "4o" stays as "4o", "4" stays as "4"
      return prefix + '-' + suffix;
    }

    // Numeric-like parts (e.g., "4o", "3.5", "405b", "70b", "4-6")
    if (/^\d/.test(part)) {
      // Handle size suffixes like "405b" → "405B"
      return part.replace(/([a-z])$/i, (_, c) => c.toUpperCase());
    }

    // Default: capitalize first letter
    if (lower.length <= 2) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  return formatted.join(' ');
}
