'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import anime from 'animejs';
import {
  newsArticles,
  type NewsArticle,
} from '@/lib/news-data';
import {
  type AIModel,
  type ArenaModel,
  formatPrice,
  formatContext,
  formatCI,
} from '@/lib/model-data';
import {
  Search,
  Clock,
  TrendingUp,
  ArrowRight,
  Zap,
  Menu,
  X,
  Mail,
  ArrowUp,
  Share2,
  Bookmark,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Globe,
  Send,
  Trophy,
 ChevronRight,
 Loader2,
  Users,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

/* ─────────────── constants ─────────────── */
const NAV_CATEGORIES = ['Latest', 'AI News', 'Tech Giants', 'Tech News', 'Startups & Funding', 'Research', 'Deals', 'Global & China'];

const RELATED_TABS = [
  { label: 'More AI News', category: 'AI News' },
  { label: 'Tech Giants', category: 'Tech Giants' },
  { label: 'Startups & Funding', category: 'Startups & Funding' },
  { label: 'Research', category: 'Research' },
  { label: 'Global & China', category: 'Global & China' },
];

const CATEGORY_COLOR: Record<string, string> = {
  'AI News': 'bg-violet-100 text-violet-700',
  'Tech Giants': 'bg-cyan-100 text-cyan-700',
  'Startups & Funding': 'bg-amber-100 text-amber-700',
  'Research': 'bg-orange-100 text-orange-700',
  'Deals': 'bg-pink-100 text-pink-700',
  'Global & China': 'bg-emerald-100 text-emerald-700',
};

// Fallback articles used before live data loads
const FALLBACK_HERO = newsArticles[0];
const FALLBACK_BREAKING = newsArticles.slice(0, 3);
const FALLBACK_TRENDING = newsArticles.slice(3, 8);

/* ─────────────── helpers ─────────────── */
const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

const getReadTime = (text: string) => {
  const wordCount = Math.ceil(text.length / 5);
  return Math.max(1, Math.ceil(wordCount / 250));
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/* ─────────────── Reliability Badge ─────────────── */
function ReliabilityBadge({ reliability }: { reliability: string }) {
  if (reliability === 'verified') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs border-0 gap-1">
        <ShieldCheck className="w-3 h-3" />
        <span className="hidden xs:inline">Independently </span>verified
      </Badge>
    );
  }
  return (
    <Badge className="bg-orange-100 text-orange-700 text-[10px] sm:text-xs border-0 gap-1">
      <AlertCircle className="w-3 h-3" />
      Company claim
    </Badge>
  );
}

function ReadTimeBadge({ text, className = '' }: { text: string; className?: string }) {
  const mins = getReadTime(text);
  return (
    <span className={`flex items-center gap-1 text-gray-400 font-[family-name:var(--font-dm-sans)] ${className}`}>
      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      <span>{mins} min read</span>
    </span>
  );
}

/* ─────────────── About Full-Screen ─────────────── */
function AboutScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0);
        if (overlayRef.current) {
          anime({ targets: overlayRef.current, opacity: [0, 1], duration: 300, easing: 'easeOutQuad' });
        }
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[200] bg-white" role="dialog" aria-modal="true">
      <div className="sticky top-0 z-[201] flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <button onClick={onClose} className="flex items-center gap-2 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-600 hover:text-[#0f1b3d] transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowUp className="w-4 h-4 rotate-[-90deg]" /><span>Back to News</span>
        </button>
      </div>
      <div className="h-[calc(100vh-49px)] overflow-y-auto custom-scrollbar" ref={scrollRef}>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo-full-transparent.png" alt="NewsShore" className="h-7 sm:h-9 w-auto object-contain" />
          </div>
          <h1 className="font-[family-name:var(--font-lora)] text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">About NewsShore</h1>
          <p className="font-[family-name:var(--font-dm-sans)] text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
            NewsShore is your trusted, independent source for AI and technology news. We deliver in-depth coverage of the AI industry, technology giants, startup funding, research breakthroughs, and global developments shaping the future — all with a commitment to accuracy, transparency, and accessibility.
          </p>
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-emerald-600" /></div>
              <div><h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-1">Reliability Tags</h3><p className="text-sm sm:text-base text-gray-600 leading-relaxed">Every article is labeled as either &ldquo;Independently verified&rdquo; or &ldquo;Company claim&rdquo; so you can assess credibility at a glance. We go beyond press releases to verify claims through independent sources, public filings, and expert analysis.</p></div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></div>
              <div><h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-1">Glossary Boxes</h3><p className="text-sm sm:text-base text-gray-600 leading-relaxed">Complex terms are explained in plain language with our &ldquo;Understand This Story&rdquo; feature. Each article includes a curated glossary of key terms, written in clear, jargon-free language.</p></div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-violet-600" /></div>
              <div><h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-1">Related Stories</h3><p className="text-sm sm:text-base text-gray-600 leading-relaxed">Explore related coverage across categories with in-page tabs, without losing your place.</p></div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0"><Globe className="w-5 h-5 text-cyan-600" /></div>
              <div><h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-1">Global Coverage</h3><p className="text-sm sm:text-base text-gray-600 leading-relaxed">We track developments across every major market — from Silicon Valley to Shenzhen, from London to Lagos.</p></div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Trophy className="w-5 h-5 text-amber-600" /></div>
              <div><h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-1">AI Model Intelligence Leaderboard</h3><p className="text-sm sm:text-base text-gray-600 leading-relaxed">Our AI Model Leaderboard ranks 300+ models using the LLM Stats Score from llm-stats.com — a composite metric from public benchmarks and live API metrics. Updated daily.</p></div>
            </div>
          </div>
          <Separator className="my-8 sm:my-10" />
          <div>
            <h2 className="font-[family-name:var(--font-lora)] text-xl sm:text-2xl font-bold text-gray-900 mb-4">Stay Connected</h2>
            <div className="flex flex-wrap gap-3">
              <a href="https://t.me/News_Shore" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors text-sm font-[family-name:var(--font-dm-sans)] font-medium"><Send className="w-4 h-4" /> Telegram</a>
              <a href="https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-[family-name:var(--font-dm-sans)] font-medium"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp</a>
              <a href="https://web.facebook.com/profile.php?id=61592735245077" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-[family-name:var(--font-dm-sans)] font-medium"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Facebook</a>
            </div>
          </div>
          <div className="text-center text-sm text-gray-400 font-[family-name:var(--font-dm-sans)] py-8">&copy; 2026 NewsShore. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Article Detail Fullscreen ─────────────── */
function ArticleDetail({ article, open, onClose, onArticleChange }: { article: NewsArticle | null; open: boolean; onClose: () => void; onArticleChange: (a: NewsArticle) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const savedSetRef = useRef(new Set<string>());
  const prevArticleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (article?.id && article?.id !== prevArticleIdRef.current) {
      prevArticleIdRef.current = article?.id ?? null;
      setSaved(savedSetRef.current.has(article.id));
      savedSetRef.current.delete(article.id);
    }
  }, [article?.id]);

  useEffect(() => { if (open) scrollRef.current?.scrollTo(0); }, [open]);

  useEffect(() => {
    if (open && overlayRef.current) anime({ targets: overlayRef.current, opacity: [0, 1], duration: 300, easing: 'easeOutQuad' });
  }, [open]);

  useEffect(() => {
    if (open && contentRef.current) {
      anime({ targets: contentRef.current.querySelectorAll('.article-anim'), translateY: [30, 0], opacity: [0, 1], duration: 600, delay: anime.stagger(80, { start: 150 }), easing: 'easeOutCubic' });
    }
  }, [article?.id, open]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !article) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[200] bg-white" role="dialog" aria-modal="true" aria-label={article.title}>
      <div className="sticky top-0 z-[201] flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <button onClick={onClose} className="flex items-center gap-2 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-600 hover:text-[#0f1b3d] active:text-[#0f1b3d] transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowUp className="w-4 h-4 rotate-[-90deg]" />
          <span className="hidden sm:inline">Back to News</span><span className="sm:hidden">Back</span>
        </button>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className={`h-8 w-8 transition-colors ${saved ? 'text-red-600' : 'text-gray-400 hover:text-red-600'}`} onClick={() => { const isSaved = savedSetRef.current.has(article.id); if (isSaved) { savedSetRef.current.delete(article.id); } else { savedSetRef.current.add(article.id); } setSaved(!isSaved); toast.success(isSaved ? 'Removed from saved' : 'Article saved!'); }}><Bookmark className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => { navigator.clipboard.writeText(window.location.origin + '?article=' + article.id); toast.success('Link copied!'); }}><Share2 className="w-4 h-4" /></Button>
      </div>
      <div className="h-[calc(100vh-49px)] overflow-y-auto custom-scrollbar" ref={scrollRef}>
        <div ref={contentRef} className="max-w-4xl mx-auto">
          <div className="relative w-full aspect-[21/9] sm:aspect-[21/8] shrink-0">
            <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-2 mb-3"><Badge className={`${CATEGORY_COLOR[article.category] || 'bg-gray-100 text-gray-700'} text-xs`}>{article.category}</Badge><ReliabilityBadge reliability={article.reliability} /></div>
              <h1 className="article-anim font-[family-name:var(--font-lora)] text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">{article.title}</h1>
            </div>
          </div>
          <div className="px-5 sm:px-8 lg:px-10 py-6 sm:py-8">
            <div className="article-anim flex flex-wrap items-center gap-3 sm:gap-4 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-400 font-[family-name:var(--font-dm-sans)]"><Clock className="w-3 h-3" />{formatDate(article.publishedAt)}</div>
              <Badge variant="outline" className="text-[10px] sm:text-xs border-gray-200 text-gray-500 font-[family-name:var(--font-dm-sans)] gap-1"><Globe className="w-3 h-3" /> {article.region}</Badge>
              <ReadTimeBadge text={article.body} className="text-[10px] sm:text-xs" />
            </div>
            <div className="article-anim mt-5"><p className="font-[family-name:var(--font-dm-sans)] text-base sm:text-lg lg:text-xl text-gray-700 leading-relaxed font-medium">{article.summary}</p></div>
            <div className="article-anim mt-5">{article.body.split('\n\n').map((block, i) => (<div key={i} className="mb-5"><p className="font-[family-name:var(--font-dm-sans)] text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">{block}</p></div>))}</div>
            <div className="article-anim mt-6 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm font-[family-name:var(--font-dm-sans)]">
                <span className="text-gray-500">Source:</span>
                <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline font-medium inline-flex items-center gap-1">{article.sourceName}<ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
            {article.glossary.length > 0 && (
              <div className="article-anim glossary-box rounded-lg p-4 sm:p-5 mt-6">
                <h3 className="text-red-600 font-bold font-[family-name:var(--font-lora)] text-base sm:text-lg mb-3">Understand This Story</h3>
                <div className="space-y-3">{article.glossary.map((item, i) => (<div key={i}><p className="font-semibold text-gray-900 text-sm font-[family-name:var(--font-dm-sans)]">{item.term}</p><p className="text-sm text-gray-600 font-[family-name:var(--font-dm-sans)] mt-0.5 leading-relaxed">{item.definition}</p></div>))}</div>
              </div>
            )}
            <div className="article-anim mt-8">
              <h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-4">Related Stories</h3>
              <Tabs defaultValue={RELATED_TABS[0].category}>
                <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-gray-100 p-1">
                  {RELATED_TABS.map((tab) => { const count = allArticles.filter((a) => a.category === tab.category && a.id !== article.id).length; return (<TabsTrigger key={tab.category} value={tab.category} className="text-xs sm:text-sm data-[state=active]:bg-[#0f1b3d] data-[state=active]:text-white">{tab.label}{count > 0 ? ` (${count})` : ''}</TabsTrigger>); })}
                </TabsList>
                {RELATED_TABS.map((tab) => {
                  const related = allArticles.filter((a) => a.category === tab.category && a.id !== article.id).slice(0, 4);
                  return (<TabsContent key={tab.category} value={tab.category}>
                    {related.length === 0 ? (<p className="text-sm text-gray-400 py-4 font-[family-name:var(--font-dm-sans)]">No related stories available.</p>) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{related.map((a) => (<button key={a.id} onClick={() => onArticleChange(a)} className="text-left p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group" style={{ touchAction: 'manipulation' }}>
                        <div className="flex items-center gap-2 mb-1.5"><Badge className={`${CATEGORY_COLOR[a.category] || 'bg-gray-100 text-gray-700'} text-[10px]`}>{a.category}</Badge></div>
                        <p className="font-[family-name:var(--font-lora)] text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors">{a.title}</p>
                        <div className="flex items-center justify-between mt-1"><p className="text-xs text-gray-400 font-[family-name:var(--font-dm-sans)]">{timeAgo(a.publishedAt)}</p><ReadTimeBadge text={a.body} className="text-[10px] text-gray-400" /></div>
                      </button>))}</div>
                    )}
                  </TabsContent>);
                })}
              </Tabs>
            </div>
            <div className="article-anim mt-8 pt-5 border-t border-gray-100 pb-8 flex flex-wrap items-center gap-3">
              <a href="https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 font-[family-name:var(--font-dm-sans)] transition-colors px-2 py-1.5 rounded-md border border-gray-200 hover:border-emerald-300"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg><span className="hidden sm:inline">WhatsApp</span></a>
              <a href="https://t.me/News_Shore" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-sky-600 font-[family-name:var(--font-dm-sans)] transition-colors px-2 py-1.5 rounded-md border border-gray-200 hover:border-sky-300"><Send className="w-3.5 h-3.5" /><span className="hidden sm:inline">Telegram</span></a>
              <a href="https://web.facebook.com/profile.php?id=61592735245077" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 font-[family-name:var(--font-dm-sans)] transition-colors px-2 py-1.5 rounded-md border border-gray-200 hover:border-blue-300"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg><span className="hidden sm:inline">Facebook</span></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Full Leaderboard (all models) ─────────────── */
function FullLeaderboard({ open, onClose, models, arenaModels, activeTab, onTabChange }: { open: boolean; onClose: () => void; models: AIModel[]; arenaModels: ArenaModel[]; activeTab: 'benchmark' | 'arena'; onTabChange: (tab: 'benchmark' | 'arena') => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = search.length > 1
    ? models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.organization.toLowerCase().includes(search.toLowerCase()))
    : models;
  const maxScore = filtered[0]?.score ?? 1;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-600 hover:text-[#0f1b3d] transition-colors" style={{ touchAction: 'manipulation' }}>
          <ArrowUp className="w-4 h-4 rotate-[-90deg]" /><span>Back to News</span>
        </button>
        <div className="flex-1" />
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search models..." className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/20 font-[family-name:var(--font-dm-sans)]" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            <h1 className="font-[family-name:var(--font-lora)] text-xl sm:text-2xl font-bold text-gray-900">AI Model Leaderboard</h1>
          </div>
          {/* Tab Switcher + Methodology */}
          <div className="flex items-center gap-3 mb-1 ml-7 sm:ml-8 flex-wrap">
            <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
              <button onClick={() => onTabChange('benchmark')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-[family-name:var(--font-dm-sans)] font-semibold transition-all ${activeTab === 'benchmark' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} style={{ touchAction: 'manipulation' }}><BarChart3 className="w-3.5 h-3.5" /> Benchmarks</button>
              <button onClick={() => onTabChange('arena')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-[family-name:var(--font-dm-sans)] font-semibold transition-all ${activeTab === 'arena' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} style={{ touchAction: 'manipulation' }}><Users className="w-3.5 h-3.5" /> Human Votes</button>
            </div>
          </div>
          {activeTab === 'benchmark' ? (
            <p className="text-xs sm:text-sm text-gray-500 ml-7 sm:ml-8 mb-4">Top {filtered.length} models ranked by <a href="https://llm-stats.com/methodology/llm-stats-score" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">benchmark performance (LLM Stats Score)</a> — standardized tests for coding, math & reasoning from <a href="https://llm-stats.com" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">llm-stats.com</a></p>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500 ml-7 sm:ml-8 mb-4">Top {arenaModels.length} models ranked by <a href="https://arena.ai/leaderboard/text" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">human preference (Arena Score)</a> — blind head-to-head votes from real users on <a href="https://arena.ai" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">arena.ai</a></p>
          )}

          {activeTab === 'benchmark' ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-[family-name:var(--font-dm-sans)] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Rank</div><div className="col-span-3">Model</div><div className="col-span-2">Org</div><div className="col-span-2">Score</div><div className="col-span-3">Context</div><div className="col-span-1 text-right">Link</div>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map((model) => (
                <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer" className={`w-full grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 sm:py-3.5 items-center hover:bg-gray-50/80 transition-colors text-left ${model.rank <= 3 ? 'bg-amber-50/30' : ''}`} style={{ touchAction: 'manipulation' }}>
                  <div className="col-span-1 flex items-center">{model.rank <= 3 ? (<span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-sm ${model.rank === 1 ? 'bg-amber-400' : model.rank === 2 ? 'bg-gray-400' : 'bg-amber-600'}`}>{model.rank}</span>) : (<span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] sm:text-xs font-bold">{model.rank}</span>)}</div>
                  <div className="col-span-7 sm:col-span-3 min-w-0">
                    <p className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900 truncate">{model.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-[family-name:var(--font-dm-sans)] sm:hidden">{model.organization} &middot; {formatContext(model.context)}</p>
                  </div>
                  <div className="hidden sm:block sm:col-span-2"><p className="text-xs sm:text-sm text-gray-600 font-[family-name:var(--font-dm-sans)] truncate">{model.organization}</p></div>
                  <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                    {model.score !== null ? (
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full bg-[#0f1b3d]" style={{ width: `${(model.score / maxScore) * 100}%`, opacity: 0.85 }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 font-[family-name:var(--font-dm-sans)]">{model.score}</span>
                    </div>
                    ) : (<span className="text-xs text-gray-400">—</span>)}
                  </div>
                  <div className="hidden sm:block sm:col-span-3"><p className="text-[10px] sm:text-xs text-gray-500 font-[family-name:var(--font-dm-sans)]">{formatContext(model.context)}</p></div>
                  <div className="col-span-4 sm:col-span-1 flex justify-end">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </a>
              ))}
            </div>
          </div>
          ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-[family-name:var(--font-dm-sans)] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">Rank</div><div className="col-span-3">Model</div><div className="col-span-2">Org</div><div className="col-span-2">Score</div><div className="col-span-2">Votes</div><div className="col-span-2 text-right">Link</div>
            </div>
            <div className="divide-y divide-gray-50">
              {arenaModels.map((model) => (
                <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer" className={`w-full grid grid-cols-12 gap-2 px-4 sm:px-5 py-3 sm:py-3.5 items-center hover:bg-gray-50/80 transition-colors text-left ${model.rank <= 3 ? 'bg-emerald-50/30' : ''}`} style={{ touchAction: 'manipulation' }}>
                  <div className="col-span-1 flex items-center">{model.rank <= 3 ? (<span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-sm ${model.rank === 1 ? 'bg-emerald-400' : model.rank === 2 ? 'bg-gray-400' : 'bg-emerald-600'}`}>{model.rank}</span>) : (<span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] sm:text-xs font-bold">{model.rank}</span>)}</div>
                  <div className="col-span-7 sm:col-span-3 min-w-0">
                    <p className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900 truncate">{model.name.replace(/-text$|-high$|-max$/g, m => m === '-text' ? '' : ` (${m.slice(1)})`)}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-[family-name:var(--font-dm-sans)] sm:hidden">{model.organization} &middot; {model.arena_score} {formatCI(model.ci_lower, model.ci_upper)}</p>
                  </div>
                  <div className="hidden sm:block sm:col-span-2"><p className="text-xs sm:text-sm text-gray-600 font-[family-name:var(--font-dm-sans)] truncate">{model.organization}</p></div>
                  <div className="hidden sm:flex sm:col-span-2 items-center gap-2">
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${((model.arena_score - (arenaModels[0]?.arena_score ?? 1500) + 80) / 80) * 100}%`, opacity: 0.8 }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 font-[family-name:var(--font-dm-sans)]">{model.arena_score}</span>
                    </div>
                  </div>
                  <div className="hidden sm:block sm:col-span-2">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-[family-name:var(--font-dm-sans)]">{model.votes.toLocaleString()} votes</p>
                    <p className="text-[9px] text-gray-400 font-[family-name:var(--font-dm-sans)]">{formatCI(model.ci_lower, model.ci_upper)}</p>
                  </div>
                  <div className="col-span-4 sm:col-span-2 flex justify-end">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </a>
              ))}
            </div>
          </div>
          )}
          <p className="text-[10px] sm:text-xs text-gray-400 mt-2 ml-1 font-[family-name:var(--font-dm-sans)]">
            {activeTab === 'benchmark'
              ? <>Ranked by <strong>LLM Stats Score</strong> — a composite metric from public benchmarks and live API metrics. A model can rank differently on human-preference leaderboards — see the Human Votes tab.</>
              : <>Ranked by <strong>Arena Score</strong> — Bradley-Terry ratings from blind human preference votes. Rankings may differ from benchmark leaderboards — see the Benchmarks tab.</>}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Breaking News Ticker ─────────────── */
function BreakingTicker({ articles }: { articles: NewsArticle[] }) {
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = innerRef.current; if (!el) return;
    anime({ targets: el, translateX: [0, -el.scrollWidth / 2], duration: 60000, easing: 'linear', loop: true });
  }, [articles]);
  const doubled = [...articles, ...articles];
  return (
    <div className="bg-red-600 text-white overflow-hidden">
      <div className="flex items-center">
        <div className="bg-red-700 px-3 sm:px-4 py-2 flex items-center gap-2 shrink-0 z-10 font-[family-name:var(--font-dm-sans)] font-bold text-xs sm:text-sm uppercase tracking-wider"><Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span>Breaking</span></div>
        <div className="flex-1 overflow-hidden py-2"><div ref={innerRef} className="flex whitespace-nowrap gap-12 sm:gap-16">{doubled.map((item, i) => (<span key={i} className="text-xs sm:text-sm font-[family-name:var(--font-dm-sans)] inline-flex items-center gap-2 sm:gap-3"><span className="text-red-200">●</span>{item.title}</span>))}</div></div>
      </div>
    </div>
  );
}

/* ─────────────── Header ─────────────── */
function Header({ onCategoryClick, onAboutOpen, onArticleSelect, searchableArticles }: { onCategoryClick: (cat: string) => void; onAboutOpen: () => void; onArticleSelect: (article: NewsArticle) => void; searchableArticles: NewsArticle[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const searchResults = searchQuery.length > 1 ? searchableArticles.filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.summary.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6) : [];

  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 40); window.addEventListener('scroll', onScroll); return () => window.removeEventListener('scroll', onScroll); }, []);
  useEffect(() => { if (headerRef.current) anime({ targets: headerRef.current, translateY: [-80, 0], opacity: [0, 1], duration: 800, easing: 'easeOutExpo' }); }, []);
  const handleNavClick = (link: string) => { setMobileOpen(false); if (link === 'About') { onAboutOpen(); } else { onCategoryClick(link); document.getElementById('latest-stories')?.scrollIntoView({ behavior: 'smooth' }); } };
  const openSearch = useCallback(() => { setSearchActive(true); requestAnimationFrame(() => searchInputRef.current?.focus()); }, []);
  const closeSearch = useCallback(() => { setSearchActive(false); setSearchQuery(''); }, []);
  useEffect(() => { if (!searchActive) return; const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch(); }; window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, [searchActive, closeSearch]);

  return (
    <header ref={headerRef} className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0f1b3d]/95 backdrop-blur-md shadow-lg' : 'bg-[#0f1b3d]'}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <button onClick={() => { onCategoryClick('Latest'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center" style={{ touchAction: 'manipulation' }}><img src="/logo-full-transparent.png" alt="NewsShore" className="h-[18px] sm:h-[21px] lg:h-[27px] w-auto object-contain" /></button>
          <nav ref={navRef} className="hidden lg:flex items-center gap-1">
            {NAV_CATEGORIES.map((link) => (<button key={link} onClick={() => handleNavClick(link)} className="px-3 py-2 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-300 hover:text-white transition-colors rounded-md hover:bg-white/10">{link}</button>))}
            <button onClick={() => handleNavClick('About')} className="px-3 py-2 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-300 hover:text-white transition-colors rounded-md hover:bg-white/10">About</button>
          </nav>
          <div className="flex items-center gap-1 relative">
            {searchActive && (
              <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 z-50">
                <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" /><input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search articles..." className="w-full pl-9 pr-8 py-2 bg-white rounded-xl shadow-2xl border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/20 font-[family-name:var(--font-dm-sans)]" />{searchQuery && (<button onClick={closeSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>)}</div>
                {searchResults.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"><div className="max-h-80 overflow-y-auto custom-scrollbar">{searchResults.map((article) => (<button key={article.id} className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0" onClick={() => { closeSearch(); onArticleSelect(article); }} style={{ touchAction: 'manipulation' }}><img src={article.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" /><div className="min-w-0"><p className="text-sm font-[family-name:var(--font-lora)] font-semibold text-gray-900 line-clamp-2 leading-snug">{article.title}</p><p className="text-xs text-gray-400 mt-1 font-[family-name:var(--font-dm-sans)]">{article.category} · {timeAgo(article.publishedAt)}</p></div></button>))}</div></div>)}
                {searchQuery.length > 1 && searchResults.length === 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 p-6 text-center"><p className="text-sm text-gray-400 font-[family-name:var(--font-dm-sans)]">No results found</p></div>)}
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={openSearch} className="text-gray-300 hover:text-white hover:bg-white/10"><Search className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" className="lg:hidden text-gray-300 hover:text-white hover:bg-white/10" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</Button>
          </div>
        </div>
        {mobileOpen && (<nav className="lg:hidden pb-4 border-t border-white/10"><div className="grid grid-cols-2 gap-1 pt-3">{NAV_CATEGORIES.map((link) => (<button key={link} onClick={() => handleNavClick(link)} className="px-3 py-2.5 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors" style={{ touchAction: 'manipulation' }}>{link}</button>))}<button onClick={() => handleNavClick('About')} className="px-3 py-2.5 text-sm font-[family-name:var(--font-dm-sans)] font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors" style={{ touchAction: 'manipulation' }}>About</button></div></nav>)}
      </div>
    </header>
  );
}

/* ─────────────── Hero: Single Top News ─────────────── */
function HeroTopNews({ heroArticle, onArticleClick }: { heroArticle: NewsArticle; onArticleClick: (a: NewsArticle) => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    anime({ targets: ref.current.querySelectorAll('.hero-animate'), translateY: [60, 0], opacity: [0, 1], duration: 1000, delay: anime.stagger(150, { start: 200 }), easing: 'easeOutCubic' });
  }, []);

  return (
    <section ref={ref} className="lg:col-span-2">
      <article className="hero-animate group relative rounded-xl sm:rounded-2xl overflow-hidden bg-gray-900 cursor-pointer h-[320px] sm:h-[440px] lg:h-[520px]" onClick={() => onArticleClick(heroArticle)} style={{ touchAction: 'manipulation' }}>
        <img src={heroArticle.image} alt={heroArticle.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
            <Badge className={`${CATEGORY_COLOR[heroArticle.category] || 'bg-gray-100 text-gray-700'} font-[family-name:var(--font-dm-sans)] text-xs sm:text-sm`}>{heroArticle.category}</Badge>
            <ReliabilityBadge reliability={heroArticle.reliability} />
            <Badge variant="outline" className="bg-white/10 border-white/20 text-white text-[10px] sm:text-xs font-[family-name:var(--font-dm-sans)] gap-1"><Globe className="w-3 h-3" /> {heroArticle.region}</Badge>
          </div>
          <h1 className="font-[family-name:var(--font-lora)] text-xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mt-2">{heroArticle.title}</h1>
          <p className="font-[family-name:var(--font-dm-sans)] text-gray-300 mt-2 sm:mt-3 text-sm sm:text-base lg:text-lg line-clamp-2 max-w-2xl">{heroArticle.summary}</p>
          <div className="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4">
            <ReadTimeBadge text={heroArticle.body} className="text-gray-300 text-xs sm:text-sm" />
            <span className="text-gray-400 text-xs sm:text-sm font-[family-name:var(--font-dm-sans)]">{timeAgo(heroArticle.publishedAt)}</span>
          </div>
        </div>
      </article>
    </section>
  );
}

/* ─────────────── Sidebar: Top 5 Models + Subscribe ─────────────── */
function SidebarLeaderboard({ onSeeMore, models, loading, arenaModels, arenaLoading, activeTab, onTabChange }: {
  onSeeMore: () => void;
  models: AIModel[];
  loading?: boolean;
  arenaModels: ArenaModel[];
  arenaLoading?: boolean;
  activeTab: 'benchmark' | 'arena';
  onTabChange: (tab: 'benchmark' | 'arena') => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const maxScore = models[0]?.score ?? 1;
  const top5 = models.slice(0, 5);
  const arenaTop5 = arenaModels.slice(0, 5);
  const maxArena = arenaTop5[0]?.arena_score ?? 1;

  useEffect(() => {
    if (!ref.current) return;
    if (activeTab === 'benchmark' && !loading) {
      anime({ targets: ref.current.querySelectorAll('.lb-anim'), translateX: [20, 0], opacity: [0, 1], duration: 500, delay: anime.stagger(60, { start: 200 }), easing: 'easeOutCubic' });
    } else if (activeTab === 'arena' && !arenaLoading) {
      anime({ targets: ref.current.querySelectorAll('.lb-anim'), translateX: [20, 0], opacity: [0, 1], duration: 500, delay: anime.stagger(60, { start: 200 }), easing: 'easeOutCubic' });
    }
  }, [activeTab, loading, arenaLoading]);

  return (
    <aside ref={ref} className="lg:col-span-1 flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
          <h3 className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900">Top 5 AI Models</h3>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex gap-1 mb-1 p-0.5 bg-gray-100 rounded-lg">
          <button onClick={() => onTabChange('benchmark')} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-[family-name:var(--font-dm-sans)] font-semibold transition-all ${activeTab === 'benchmark' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} style={{ touchAction: 'manipulation' }}>
            <BarChart3 className="w-3 h-3" /> Benchmarks
          </button>
          <button onClick={() => onTabChange('arena')} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-[family-name:var(--font-dm-sans)] font-semibold transition-all ${activeTab === 'arena' ? 'bg-white text-[#0f1b3d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} style={{ touchAction: 'manipulation' }}>
            <Users className="w-3 h-3" /> Human Votes
          </button>
        </div>

        {/* ── Methodology Label ── */}
        {activeTab === 'benchmark' ? (
          <p className="text-[9px] sm:text-[10px] text-gray-400 font-[family-name:var(--font-dm-sans)] mb-3 leading-tight">Ranked by benchmark performance <a href="https://llm-stats.com/methodology/llm-stats-score" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-600 underline decoration-dotted underline-offset-2">(LLM Stats Score)</a> — standardized tests for coding, math & reasoning</p>
        ) : (
          <p className="text-[9px] sm:text-[10px] text-gray-400 font-[family-name:var(--font-dm-sans)] mb-3 leading-tight">Ranked by human preference <a href="https://arena.ai/leaderboard/text" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-600 underline decoration-dotted underline-offset-2">(Arena Score)</a> — blind head-to-head votes from real users</p>
        )}

        {/* ── Benchmark Tab ── */}
        {activeTab === 'benchmark' && (
          loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-2.5 rounded-lg"><div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" /><div className="flex-1 min-w-0 space-y-2"><div className="h-3.5 bg-gray-200 rounded animate-pulse w-3/4" /><div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-200 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} /></div></div></div></div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {top5.map((model) => (
                <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer" className="lb-anim w-full text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors group block" style={{ touchAction: 'manipulation' }}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${model.rank === 1 ? 'bg-amber-400' : model.rank === 2 ? 'bg-gray-400' : model.rank === 3 ? 'bg-amber-600' : 'bg-gray-200 text-gray-500'}`}>{model.rank}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-[family-name:var(--font-lora)] text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-red-600 transition-colors inline-flex items-center gap-1">{model.name}<ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-red-400 shrink-0" /></p>
                        <span className="text-[10px] text-gray-400 font-[family-name:var(--font-dm-sans)] tabular-nums">{model.score ?? '—'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-500 font-[family-name:var(--font-dm-sans)]">{model.organization}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#0f1b3d]" style={{ width: `${((model.score ?? 0) / maxScore) * 100}%`, opacity: 0.8 }} />
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
        )}

        {/* ── Arena (Human Votes) Tab ── */}
        {activeTab === 'arena' && (
          arenaLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-2.5 rounded-lg"><div className="flex items-center gap-2.5"><div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" /><div className="flex-1 min-w-0 space-y-2"><div className="h-3.5 bg-gray-200 rounded animate-pulse w-3/4" /><div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-200 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} /></div></div></div></div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {arenaTop5.map((model) => (
                <a key={model.rank} href={model.url} target="_blank" rel="noopener noreferrer" className="lb-anim w-full text-left p-2.5 rounded-lg hover:bg-gray-50 transition-colors group block" style={{ touchAction: 'manipulation' }}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${model.rank === 1 ? 'bg-emerald-400' : model.rank === 2 ? 'bg-gray-400' : model.rank === 3 ? 'bg-emerald-600' : 'bg-gray-200 text-gray-500'}`}>{model.rank}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-[family-name:var(--font-lora)] text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-red-600 transition-colors inline-flex items-center gap-1">{model.name.replace(/-text$|-high$|-max$/g, m => m === '-text' ? '' : ` (${m.slice(1)})`)}<ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-red-400 shrink-0" /></p>
                        <span className="text-[10px] text-gray-400 font-[family-name:var(--font-dm-sans)] tabular-nums">{model.arena_score}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-500 font-[family-name:var(--font-dm-sans)]">{model.organization}</span>
                        <span className="text-[9px] text-gray-400 font-[family-name:var(--font-dm-sans)]">{formatCI(model.ci_lower, model.ci_upper)} &middot; {model.votes.toLocaleString()} votes</span>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${((model.arena_score - (maxArena - 100)) / 100) * 100}%`, opacity: 0.75 }} />
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
        )}

        <button onClick={onSeeMore} className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-[family-name:var(--font-dm-sans)] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg py-2 transition-colors" style={{ touchAction: 'manipulation' }}>
          See Full Leaderboard <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}


/* ─────────────── Subscribe Section ─────────────── */
function SubscribeSection() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Please enter your email address.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setEmail('');
      } else {
        toast.error(data.error || 'Subscription failed.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
        <h3 className="font-[family-name:var(--font-lora)] text-sm sm:text-base font-bold text-gray-900">Daily Briefing</h3>
      </div>
      <p className="text-xs text-gray-500 font-[family-name:var(--font-dm-sans)] leading-relaxed mb-3">Get the top AI &amp; tech stories delivered to your inbox every morning.</p>
      <div className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f1b3d]/20 font-[family-name:var(--font-dm-sans)]" onKeyDown={(e) => { if (e.key === 'Enter') handleSubscribe(); }} />
        <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs sm:text-sm px-3 sm:px-4 shrink-0 disabled:opacity-60" onClick={handleSubscribe} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────── News Card ─────────────── */
function NewsCard({ article, index, onClick }: { article: NewsArticle; index: number; onClick: (a: NewsArticle) => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!cardRef.current) return; anime({ targets: cardRef.current, translateY: [40, 0], opacity: [0, 1], duration: 700, delay: index * 80, easing: 'easeOutCubic' }); }, [index]);
  return (
    <div ref={cardRef}><article className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col news-card-hover" onClick={() => onClick(article)} style={{ touchAction: 'manipulation' }}>
      <div className="relative h-36 sm:h-48 overflow-hidden"><img src={article.image} alt={article.title} className="w-full h-full object-cover img-zoom" /><div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex flex-wrap items-center gap-1.5"><Badge className={`${CATEGORY_COLOR[article.category] || 'bg-gray-100 text-gray-700'} text-[10px] sm:text-xs font-[family-name:var(--font-dm-sans)]`}>{article.category}</Badge><ReliabilityBadge reliability={article.reliability} /></div></div>
      <div className="p-3.5 sm:p-5 flex flex-col flex-1">
        <h3 className="font-[family-name:var(--font-lora)] text-base sm:text-lg font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-red-600 transition-colors">{article.title}</h3>
        <p className="font-[family-name:var(--font-dm-sans)] text-xs sm:text-sm text-gray-500 mt-2 line-clamp-2 flex-1">{article.summary}</p>
        <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-50">
          <Badge variant="outline" className="text-[10px] sm:text-xs border-gray-200 text-gray-500 font-[family-name:var(--font-dm-sans)] gap-1"><Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {article.region}</Badge>
          <div className="flex items-center gap-2"><ReadTimeBadge text={article.body} className="text-[10px] sm:text-xs" /><span className="text-[10px] sm:text-xs text-gray-400 font-[family-name:var(--font-dm-sans)]">{timeAgo(article.publishedAt)}</span></div>
        </div>
      </div>
    </article></div>
  );
}

/* ─────────────── Trending Item ─────────────── */
function TrendingItem({ article, index, onClick }: { article: NewsArticle; index: number; onClick: (a: NewsArticle) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!ref.current) return; anime({ targets: ref.current, translateX: [30, 0], opacity: [0, 1], duration: 500, delay: 600 + index * 100, easing: 'easeOutCubic' }); }, [index]);
  return (
    <div ref={ref} onClick={() => onClick(article)} style={{ touchAction: 'manipulation' }}>
      <div className="flex gap-3 group cursor-pointer py-1">
        <span className="font-[family-name:var(--font-lora)] text-2xl sm:text-3xl font-bold text-red-200 shrink-0 w-7 sm:w-8">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-lora)] text-xs sm:text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-red-600 transition-colors">{article.title}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-xs text-gray-400 font-[family-name:var(--font-dm-sans)]"><span>{article.category}</span><span>&middot;</span><span>{article.region}</span><span>&middot;</span><ReadTimeBadge text={article.body} className="text-[10px] text-gray-400" /></div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Footer ─────────────── */
function Footer({ onCategoryClick, onAboutOpen }: { onCategoryClick: (cat: string) => void; onAboutOpen: () => void }) {
  return (
    <footer className="bg-[#0f1b3d] text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3 sm:mb-4"><img src="/logo-full-transparent.png" alt="NewsShore" className="h-5 sm:h-6 lg:h-7 w-auto object-contain" /></div>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">Your trusted source for AI and technology news with verified sourcing and comprehensive coverage.</p>
            <div className="flex items-center gap-2">
              <a href="https://t.me/News_Shore" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"><Send className="w-4 h-4" /></a>
              <a href="https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
              <a href="https://web.facebook.com/profile.php?id=61592735245077" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
            </div>
          </div>
          <div><h4 className="font-[family-name:var(--font-lora)] font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Sections</h4><ul className="space-y-2 sm:space-y-2.5">{['AI News', 'Tech Giants', 'Startups & Funding', 'Research', 'Global & China'].map((item) => (<li key={item}><button onClick={() => onCategoryClick(item)} className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors" style={{ touchAction: 'manipulation' }}>{item}</button></li>))}</ul></div>
          <div><h4 className="font-[family-name:var(--font-lora)] font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Company</h4><ul className="space-y-2 sm:space-y-2.5">{['About Us', 'Careers', 'Contact', 'Advertise', 'Press Kit'].map((item) => (<li key={item}><button onClick={() => { if (item === 'About Us') onAboutOpen(); else toast.info(`${item} page coming soon!`); }} className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors" style={{ touchAction: 'manipulation' }}>{item}</button></li>))}</ul></div>
          <div><h4 className="font-[family-name:var(--font-lora)] font-bold text-white mb-3 sm:mb-4 text-sm sm:text-base">Legal</h4><ul className="space-y-2 sm:space-y-2.5">{['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Accessibility'].map((item) => (<li key={item}><button onClick={() => toast.info(`${item} page coming soon!`)} className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors" style={{ touchAction: 'manipulation' }}>{item}</button></li>))}</ul></div>
        </div>
        <Separator className="bg-white/10 my-6 sm:my-8" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
          <p>&copy; 2026 NewsShore. All rights reserved.</p>
          <button
            onClick={async () => {
              try {
                toast.loading('Preparing download...');
                const res = await fetch('/api/download');
                if (!res.ok) throw new Error('fail');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'newsshore-project.zip';
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
                toast.dismiss(); toast.success('Download started!');
              } catch { toast.dismiss(); toast.error('Download failed — try again'); }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Project
          </button>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function Home() {
  const [activeCategory, setActiveCategory] = useState('Latest');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [articleOpen, setArticleOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardModels, setLeaderboardModels] = useState<AIModel[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [arenaModels, setArenaModels] = useState<ArenaModel[]>([]);
  const [arenaLoading, setArenaLoading] = useState(true);
  const [lbTab, setLbTab] = useState<'benchmark' | 'arena'>('benchmark');
  const [liveArticles, setLiveArticles] = useState<NewsArticle[]>([]);

  // Fetch pipeline articles from Supabase
  useEffect(() => {
    let cancelled = false;
    fetch('/api/articles')
      .then(r => r.json())
      .then(data => { if (!cancelled && data?.success) setLiveArticles(data.articles ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Merge: pipeline articles first (newest), then static (dedup by title)
  const allArticles = useMemo(() => {
    const seen = new Set(liveArticles.map(a => a.title.toLowerCase()));
    const staticUnique = newsArticles.filter(a => !seen.has(a.title.toLowerCase()));
    return [...liveArticles, ...staticUnique];
  }, [liveArticles]);

  const handleScroll = useCallback(() => setShowTop(window.scrollY > 600), []);
  useEffect(() => { window.addEventListener('scroll', handleScroll); return () => window.removeEventListener('scroll', handleScroll); }, [handleScroll]);

  const openArticle = useCallback((article: NewsArticle) => { setSelectedArticle(article); setArticleOpen(true); }, []);
  const closeArticle = useCallback(() => { setArticleOpen(false); setTimeout(() => setSelectedArticle(null), 300); }, []);
  const handleArticleChange = useCallback((article: NewsArticle) => { setSelectedArticle(article); }, []);
  const handleCategoryClick = useCallback((cat: string) => { setActiveCategory(cat); document.getElementById('latest-stories')?.scrollIntoView({ behavior: 'smooth' }); }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leaderboard?limit=100')
      .then(res => res.json())
      .then(data => { if (!cancelled && data?.success) setLeaderboardModels(data.models ?? []); })
      .catch(() => { if (!cancelled) setLeaderboardModels([]); })
      .finally(() => { if (!cancelled) setLeaderboardLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/arena-leaderboard?limit=100')
      .then(res => res.json())
      .then(data => { if (!cancelled && data?.success) setArenaModels(data.models ?? []); })
      .catch(() => { if (!cancelled) setArenaModels([]); })
      .finally(() => { if (!cancelled) setArenaLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = activeCategory === 'Latest'
    ? allArticles.slice(3)
    : allArticles.filter((a) => a.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-dm-sans)]">
      <Header onCategoryClick={handleCategoryClick} onAboutOpen={() => setAboutOpen(true)} onArticleSelect={openArticle} searchableArticles={allArticles} />
      <BreakingTicker articles={allArticles.length >= 3 ? allArticles.slice(0, 3) : FALLBACK_BREAKING} />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <HeroTopNews heroArticle={allArticles[0] || FALLBACK_HERO} onArticleClick={openArticle} />
            <div className="lg:col-span-1 flex flex-col gap-4">
              <SidebarLeaderboard onSeeMore={() => setLeaderboardOpen(true)} models={leaderboardModels} loading={leaderboardLoading} arenaModels={arenaModels} arenaLoading={arenaLoading} activeTab={lbTab} onTabChange={setLbTab} />
              <SubscribeSection />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <Separator className="my-1 sm:my-2" />
          <div id="latest-stories" className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 pb-8 sm:pb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-5 sm:mb-6"><Zap className="w-5 h-5 text-red-600" /><h2 className="font-[family-name:var(--font-lora)] text-xl sm:text-2xl font-bold text-gray-900">{activeCategory === 'Latest' ? 'Latest Stories' : activeCategory}</h2></div>
              {filtered.length === 0 ? (<div className="text-center py-16 text-gray-400"><p className="text-lg font-[family-name:var(--font-lora)]">No articles found</p><p className="text-sm mt-1">Try selecting a different category</p></div>) : (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">{filtered.map((article, i) => (<NewsCard key={article.id} article={article} index={i} onClick={openArticle} />))}</div>)}
              {activeCategory === 'Latest' && (<div className="mt-8"><Button variant="outline" size="lg" className="w-full sm:w-auto mx-auto flex items-center gap-2 font-[family-name:var(--font-dm-sans)] text-sm text-gray-600 border-gray-300 hover:border-[#0f1b3d] hover:text-[#0f1b3d]" onClick={() => toast.info('More stories coming soon!')}>Load More Stories<ArrowRight className="w-4 h-4" /></Button></div>)}
            </div>
            <aside className="lg:col-span-1"><div className="lg:sticky lg:top-20 space-y-4 sm:space-y-6"><div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5"><div className="flex items-center gap-2 mb-4 sm:mb-5"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" /><h3 className="font-[family-name:var(--font-lora)] text-base sm:text-lg font-bold text-gray-900">Trending Now</h3></div><div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto custom-scrollbar">{(allArticles.length >= 8 ? allArticles.slice(3, 8) : FALLBACK_TRENDING).map((article, i) => (<TrendingItem key={article.id} article={article} index={i} onClick={openArticle} />))}</div></div></div></aside>
          </div>
        </div>
      </main>
      <Footer onCategoryClick={handleCategoryClick} onAboutOpen={() => setAboutOpen(true)} />
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 bg-[#0f1b3d] text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-40 hover:bg-red-600 ${showTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`} aria-label="Back to top" style={{ touchAction: 'manipulation' }}><ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" /></button>
      <ArticleDetail article={selectedArticle} open={articleOpen} onClose={closeArticle} onArticleChange={handleArticleChange} />
      <AboutScreen open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <FullLeaderboard open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} models={leaderboardModels} arenaModels={arenaModels} activeTab={lbTab} onTabChange={setLbTab} />
    </div>
  );
}
