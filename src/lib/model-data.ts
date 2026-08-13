/**
 * AI Model Leaderboard Types & Helpers
 *
 * Two independent ranking systems are used:
 *
 * 1. Benchmark Performance  →  llm-stats.com  (LLM Stats Score)
 *    Measures raw capability on standardized tests (coding, math, reasoning).
 *    Source: https://llm-stats.com/leaderboards/llm-leaderboard
 *
 * 2. Human Preference  →  arena.ai / LMArena  (Bradley-Terry Arena Score)
 *    Measures which response real humans actually preferred in blind
 *    head-to-head comparisons.
 *    Source: https://arena.ai/leaderboard/text
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
