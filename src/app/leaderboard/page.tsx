'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft, Trophy, BarChart3, Users, ExternalLink } from 'lucide-react';
import { type AIModel, type ArenaModel, formatContext, formatCI } from '@/lib/model-data';

export default function LeaderboardPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [arenaModels, setArenaModels] = useState<ArenaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'benchmark' | 'arena'>('benchmark');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/leaderboard?limit=100').then(r => r.json()),
      fetch('/api/arena-leaderboard?limit=100').then(r => r.json()),
    ]).then(([benchData, arenaData]) => {
      if (!cancelled) {
        if (benchData.success) setModels(benchData.models ?? []);
        if (arenaData.success) setArenaModels(arenaData.models ?? []);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = search.length > 1
    ? models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.organization.toLowerCase().includes(search.toLowerCase()))
    : models;
  const maxScore = filtered[0]?.score ?? 1;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-dm-sans)] bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0f1b3d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to News</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <div className="flex-1" />
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..." className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/20" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            <h1 className="font-[family-name:var(--font-lora)] text-xl sm:text-2xl font-bold text-gray-900">AI Model Leaderboard</h1>
          </div>
          <div className="flex items-center gap-3 mb-1 ml-7 sm:ml-8 flex-wrap">
            <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
              <button onClick={() => setTab('benchmark')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${tab === 'benchmark' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><BarChart3 className="w-3.5 h-3.5" /> Benchmarks</button>
              <button onClick={() => setTab('arena')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${tab === 'arena' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Users className="w-3.5 h-3.5" /> Human Votes</button>
            </div>
          </div>
          {tab === 'benchmark' ? (
            <p className="text-xs sm:text-sm text-gray-500 ml-7 sm:ml-8 mb-4">Top {filtered.length} models ranked by <a href="https://llm-stats.com/methodology/llm-stats-score" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">benchmark performance (LLM Stats Score)</a> — standardized tests for coding, math & reasoning from <a href="https://llm-stats.com" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">llm-stats.com</a></p>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500 ml-7 sm:ml-8 mb-4">Top {arenaModels.length} models ranked by <a href="https://arena.ai/leaderboard/text" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">human preference (Arena Score)</a> — blind head-to-head votes from real users on <a href="https://arena.ai" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">arena.ai</a></p>
          )}

          {tab === 'benchmark' ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Rank</div><div className="col-span-3">Model</div><div className="col-span-2">Org</div><div className="col-span-2">Score</div><div className="col-span-3">Context</div><div className="col-span-1 text-right">Link</div>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map(model => (
                <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer" className={`w-full grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 sm:py-3.5 items-center hover:bg-gray-50/80 transition-colors text-left ${model.rank <= 3 ? 'bg-amber-50/30' : ''}`}>
                  <div className="col-span-1 flex items-center">{model.rank <= 3 ? (<span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-sm ${model.rank === 1 ? 'bg-amber-400' : model.rank === 2 ? 'bg-gray-400' : 'bg-amber-600'}`}>{model.rank}</span>) : (<span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] sm:text-xs font-bold">{model.rank}</span>)}</div>
                  <div className="col-span-7 sm:col-span-3 min-w-0">
                    <p className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900 truncate">{model.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 sm:hidden">{model.organization} &middot; {formatContext(model.context)}</p>
                  </div>
                  <div className="hidden sm:block sm:col-span-2"><p className="text-xs sm:text-sm text-gray-600 truncate">{model.organization}</p></div>
                  <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                    {model.score !== null ? (
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full bg-[#0f1b3d]" style={{ width: `${(model.score / maxScore) * 100}%`, opacity: 0.85 }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">{model.score}</span>
                    </div>
                    ) : (<span className="text-xs text-gray-400">—</span>)}
                  </div>
                  <div className="hidden sm:block sm:col-span-3"><p className="text-[10px] sm:text-xs text-gray-500">{formatContext(model.context)}</p></div>
                  <div className="col-span-4 sm:col-span-1 flex justify-end"><ExternalLink className="w-3.5 h-3.5 text-gray-400" /></div>
                </a>
              ))}
            </div>
          </div>
          ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Rank</div><div className="col-span-3">Model</div><div className="col-span-2">Org</div><div className="col-span-2">Score</div><div className="col-span-2">Votes</div><div className="col-span-2 text-right">Link</div>
            </div>
            <div className="divide-y divide-gray-50">
              {arenaModels.map(model => (
                <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer" className={`w-full grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 sm:py-3.5 items-center hover:bg-gray-50/80 transition-colors text-left ${model.rank <= 3 ? 'bg-emerald-50/30' : ''}`}>
                  <div className="col-span-1 flex items-center">{model.rank <= 3 ? (<span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-sm ${model.rank === 1 ? 'bg-emerald-400' : model.rank === 2 ? 'bg-gray-400' : 'bg-emerald-600'}`}>{model.rank}</span>) : (<span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] sm:text-xs font-bold">{model.rank}</span>)}</div>
                  <div className="col-span-7 sm:col-span-3 min-w-0">
                    <p className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900 truncate">{model.name.replace(/-text$|-high$|-max$/g, m => m === '-text' ? '' : ` (${m.slice(1)})`)}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 sm:hidden">{model.organization} &middot; {model.arena_score} {formatCI(model.ci_lower, model.ci_upper)}</p>
                  </div>
                  <div className="hidden sm:block sm:col-span-2"><p className="text-xs sm:text-sm text-gray-600 truncate">{model.organization}</p></div>
                  <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${((model.arena_score - (arenaModels[0]?.arena_score ?? 1500) + 80) / 80) * 100}%`, opacity: 0.8 }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">{model.arena_score}</span>
                    </div>
                  </div>
                  <div className="hidden sm:block sm:col-span-2">
                    <p className="text-[10px] sm:text-xs text-gray-500">{model.votes.toLocaleString()} votes</p>
                    <p className="text-[9px] text-gray-400">{formatCI(model.ci_lower, model.ci_upper)}</p>
                  </div>
                  <div className="col-span-4 sm:col-span-2 flex justify-end"><ExternalLink className="w-3.5 h-3.5 text-gray-400" /></div>
                </a>
              ))}
            </div>
          </div>
          )}
          <p className="text-[10px] sm:text-xs text-gray-400 mt-2 ml-1">
            {tab === 'benchmark'
              ? <>Ranked by <strong>LLM Stats Score</strong> — a composite metric from public benchmarks and live API metrics. A model can rank differently on human-preference leaderboards — see the Human Votes tab.</>
              : <>Ranked by <strong>Arena Score</strong> — Bradley-Terry ratings from blind human preference votes. Rankings may differ from benchmark leaderboards — see the Benchmarks tab.</>}
          </p>
        </div>
      </main>

      <footer className="mt-auto border-t border-gray-100 bg-gray-50 py-6 px-4 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} NewsShore. All rights reserved.
      </footer>
    </div>
  );
}
