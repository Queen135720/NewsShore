'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ArrowLeft, Trophy, BarChart3, Users, ExternalLink, Loader2,
} from 'lucide-react';
import {
  type AIModel, type ArenaModel, formatContext, formatCI,
} from '@/lib/model-data';
import { Button } from '@/components/ui/button';

/* ─────────────── Skeleton Loader ─────────────── */
function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg bg-white">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-gray-200 rounded animate-pulse w-1/3" />
              <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/5" />
            </div>
            <div className="h-5 w-32 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Page ─────────────── */
export default function LeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'benchmark' | 'arena'>('benchmark');
  const [search, setSearch] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [arenaModels, setArenaModels] = useState<ArenaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [arenaLoading, setArenaLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard?limit=300')
      .then(res => res.json())
      .then(data => { if (!cancelled && data?.success) setModels(data.models ?? []); })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/arena-leaderboard?limit=300')
      .then(res => res.json())
      .then(data => { if (!cancelled && data?.success) setArenaModels(data.models ?? []); })
      .catch(() => { if (!cancelled) setArenaModels([]); })
      .finally(() => { if (!cancelled) setArenaLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredModels = useMemo(() => {
    if (search.length < 2) return models;
    return models.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.organization.toLowerCase().includes(search.toLowerCase())
    );
  }, [models, search]);

  const filteredArena = useMemo(() => {
    if (search.length < 2) return arenaModels;
    return arenaModels.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.organization.toLowerCase().includes(search.toLowerCase())
    );
  }, [arenaModels, search]);

  const maxScore = filteredModels[0]?.score ?? 1;
  const maxArena = filteredArena[0]?.arena_score ?? 1;

  return (
    <div className="min-h-screen flex flex-col bg-white font-[family-name:var(--font-dm-sans)]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0f1b3d] transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-4 h-4" /><span>Back to News</span>
          </button>
          <div className="flex-1" />
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/20"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            <h1 className="font-[family-name:var(--font-lora)] text-xl sm:text-2xl font-bold text-gray-900">AI Model Leaderboard</h1>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-3 mb-1 ml-7 sm:ml-8 flex-wrap">
            <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
              <button
                onClick={() => setActiveTab('benchmark')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${activeTab === 'benchmark' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                style={{ touchAction: 'manipulation' }}
              ><BarChart3 className="w-3.5 h-3.5" /> Benchmarks</button>
              <button
                onClick={() => setActiveTab('arena')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${activeTab === 'arena' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                style={{ touchAction: 'manipulation' }}
              ><Users className="w-3.5 h-3.5" /> Human Votes</button>
            </div>
          </div>

          {/* Methodology */}
          {activeTab === 'benchmark' ? (
            <p className="text-xs sm:text-sm text-gray-500 ml-7 sm:ml-8 mb-4">
              Top {filteredModels.length} models ranked by{' '}
              <a href="https://llm-stats.com/methodology/llm-stats-score" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">benchmark performance (LLM Stats Score)</a>
              {' '}— standardized tests for coding, math & reasoning from{' '}
              <a href="https://llm-stats.com" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">llm-stats.com</a>
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500 ml-7 sm:ml-8 mb-4">
              Top {filteredArena.length} models ranked by{' '}
              <a href="https://arena.ai/leaderboard/text" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">human preference (Arena Score)</a>
              {' '}— blind head-to-head votes from real users on{' '}
              <a href="https://arena.ai" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">arena.ai</a>
            </p>
          )}

          {/* Benchmark Table */}
          {activeTab === 'benchmark' && (
            loading ? <TableSkeleton /> : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-3">Model</div>
                  <div className="col-span-2">Org</div>
                  <div className="col-span-2">Score</div>
                  <div className="col-span-3">Context</div>
                  <div className="col-span-1 text-right">Link</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {filteredModels.map((model) => (
                    <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer"
                      className={`w-full grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 sm:py-3.5 items-center hover:bg-gray-50/80 transition-colors text-left ${model.rank <= 3 ? 'bg-amber-50/30' : ''}`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="col-span-1 flex items-center">
                        {model.rank <= 3 ? (
                          <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-sm ${model.rank === 1 ? 'bg-amber-400' : model.rank === 2 ? 'bg-gray-400' : 'bg-amber-600'}`}>{model.rank}</span>
                        ) : (
                          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] sm:text-xs font-bold">{model.rank}</span>
                        )}
                      </div>
                      <div className="col-span-7 sm:col-span-3 min-w-0">
                        <p className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900 truncate">{model.name}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 sm:hidden">{model.organization} &middot; {formatContext(model.context)}</p>
                      </div>
                      <div className="hidden sm:block sm:col-span-2">
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{model.organization}</p>
                      </div>
                      <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                        {model.score !== null ? (
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                            <div className="h-full rounded-full bg-[#0f1b3d]" style={{ width: `${(model.score / maxScore) * 100}%`, opacity: 0.85 }} />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">{model.score}</span>
                          </div>
                        ) : (<span className="text-xs text-gray-400">—</span>)}
                      </div>
                      <div className="hidden sm:block sm:col-span-3">
                        <p className="text-[10px] sm:text-xs text-gray-500">{formatContext(model.context)}</p>
                      </div>
                      <div className="col-span-4 sm:col-span-1 flex justify-end">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Arena Table */}
          {activeTab === 'arena' && (
            arenaLoading ? <TableSkeleton /> : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-3">Model</div>
                  <div className="col-span-2">Org</div>
                  <div className="col-span-2">Score</div>
                  <div className="col-span-2">Votes</div>
                  <div className="col-span-2 text-right">Link</div>
                </div>
                <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {filteredArena.map((model) => (
                    <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer"
                      className={`w-full grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 sm:py-3.5 items-center hover:bg-gray-50/80 transition-colors text-left ${model.rank <= 3 ? 'bg-emerald-50/30' : ''}`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="col-span-1 flex items-center">
                        {model.rank <= 3 ? (
                          <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-sm ${model.rank === 1 ? 'bg-emerald-400' : model.rank === 2 ? 'bg-gray-400' : 'bg-emerald-600'}`}>{model.rank}</span>
                        ) : (
                          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] sm:text-xs font-bold">{model.rank}</span>
                        )}
                      </div>
                      <div className="col-span-7 sm:col-span-3 min-w-0">
                        <p className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900 truncate">{model.name.replace(/-text$|-high$|-max$/g, m => m === '-text' ? '' : ` (${m.slice(1)})`)}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 sm:hidden">{model.organization} &middot; {model.arena_score} {formatCI(model.ci_lower, model.ci_upper)}</p>
                      </div>
                      <div className="hidden sm:block sm:col-span-2">
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{model.organization}</p>
                      </div>
                      <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${((model.arena_score - (filteredArena[0]?.arena_score ?? 1500) + 80) / 80) * 100}%`, opacity: 0.8 }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">{model.arena_score}</span>
                        </div>
                      </div>
                      <div className="hidden sm:block sm:col-span-2">
                        <p className="text-[10px] sm:text-xs text-gray-500">{model.votes.toLocaleString()} votes</p>
                        <p className="text-[9px] text-gray-400">{formatCI(model.ci_lower, model.ci_upper)}</p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 flex justify-end">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Footnote */}
          <p className="text-[10px] sm:text-xs text-gray-400 mt-2 ml-1">
            {activeTab === 'benchmark'
              ? <>Ranked by <strong>LLM Stats Score</strong> — a composite metric from public benchmarks and live API metrics. A model can rank differently on human-preference leaderboards — see the Human Votes tab.</>
              : <>Ranked by <strong>Arena Score</strong> — Bradley-Terry ratings from blind human preference votes. Rankings may differ from benchmark leaderboards — see the Benchmarks tab.</>}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#0f1b3d] text-gray-300 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-gray-500">
          &copy; 2026 NewsShore. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
