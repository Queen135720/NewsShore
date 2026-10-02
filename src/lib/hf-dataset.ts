/**
 * hf-dataset.ts
 * Shared utility for fetching leaderboard data from the HuggingFace Dataset Server API.
 * 
 * LMArena publishes their leaderboard data as the official dataset:
 *   lmarena-ai/leaderboard-dataset
 * 
 * Free, no-auth REST access:
 *   https://datasets-server.huggingface.co/rows?dataset=lmarena-ai/leaderboard-dataset&config=<config>&split=latest
 */

const HF_BASE = 'https://datasets-server.huggingface.co';
const HF_DATASET = 'lmarena-ai/leaderboard-dataset';
const PAGE_SIZE = 100;

interface HfRowResponse {
  rows?: { row: Record<string, unknown> }[];
  error?: string;
}

export async function fetchHfDatasetRows(
  config: string,
  split = 'latest',
  options?: { concurrency?: number; timeout?: number }
): Promise<Record<string, unknown>[]> {
  const concurrency = options?.concurrency ?? 5;
  const timeout = options?.timeout ?? 30000;
  const allRows: Record<string, unknown>[] = [];

  const firstUrl = `${HF_BASE}/rows?dataset=${encodeURIComponent(HF_DATASET)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=0&length=${PAGE_SIZE}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let firstData: HfRowResponse;
  try {
    const res = await fetch(firstUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HF API returned ${res.status}`);
    firstData = await res.json() as HfRowResponse;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }

  if (!firstData.rows || firstData.rows.length === 0) return allRows;
  for (const row of firstData.rows) allRows.push(row.row);
  if (firstData.rows.length < PAGE_SIZE) return allRows;

  if (config === 'text') {
    const lastRow = firstData.rows[firstData.rows.length - 1].row;
    if (lastRow.category !== 'overall') {
      return allRows.filter(r => r.category === 'overall');
    }
  }

  let offset = PAGE_SIZE;
  let done = false;

  while (!done) {
    const batchOffsets: number[] = [];
    for (let i = 0; i < concurrency; i++) batchOffsets.push(offset + i * PAGE_SIZE);

    const results = await Promise.all(
      batchOffsets.map(async (o) => {
        try {
          const url = `${HF_BASE}/rows?dataset=${encodeURIComponent(HF_DATASET)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${o}&length=${PAGE_SIZE}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
          if (!res.ok) return { rows: [] } as HfRowResponse;
          return await res.json() as HfRowResponse;
        } catch {
          return { rows: [] } as HfRowResponse;
        }
      })
    );

    let hitNonOverall = false;
    for (const data of results) {
      if (!data.rows || data.rows.length === 0) { done = true; continue; }
      for (const row of data.rows) {
        if (config === 'text' && row.row.category !== 'overall') { hitNonOverall = true; continue; }
        allRows.push(row.row);
      }
      if (data.rows.length < PAGE_SIZE) done = true;
    }
    if (hitNonOverall) done = true;
    offset += concurrency * PAGE_SIZE;
  }

  return allRows;
}
