'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { newsArticles, type NewsArticle } from '@/lib/news-data';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Globe, ArrowLeft, ExternalLink, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_COLOR: Record<string, string> = {
  'AI News': 'bg-violet-100 text-violet-700',
  'Tech Giants': 'bg-cyan-100 text-cyan-700',
  'Startups & Funding': 'bg-amber-100 text-amber-700',
  'Mobile & Social': 'bg-sky-100 text-sky-700',
  'Research': 'bg-orange-100 text-orange-700',
  'Deals': 'bg-pink-100 text-pink-700',
  'Global Tech': 'bg-emerald-100 text-emerald-700',
  'Latest': 'bg-gray-100 text-gray-700',
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const getReadTime = (t: string) => Math.max(1, Math.ceil(Math.ceil(t.length / 5) / 250));
const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`; };

function ReliabilityBadge({ r }: { r: string }) {
  return r === 'verified'
    ? <Badge className="bg-green-100 text-green-700 text-xs"><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />Verified</Badge>
    : <Badge className="bg-yellow-100 text-yellow-700 text-xs"><span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1" />Claimed</Badge>;

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);

    // Bulleted list: every line starts with -, *, or •
    if (lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l))) {
      return (
        <ul key={i} className="list-disc pl-6 mb-6 space-y-2 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
          {lines.map((l, j) => <li key={j}>{inlineFormat(l.replace(/^[-*•]\s+/, ''))}</li>)}
        </ul>
      );
    }

    // Numbered list: every line starts with 1. or 1)
    if (lines.length > 0 && lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      return (
        <ol key={i} className="list-decimal pl-6 mb-6 space-y-2 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
          {lines.map((l, j) => <li key={j}>{inlineFormat(l.replace(/^\d+[.)]\s+/, ''))}</li>)}
        </ol>
      );
    }

    return (
      <p key={i} className="mb-5 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
        {inlineFormat(trimmed)}
      </p>
    );
  });
}
}

// Convert AI markdown (## subheads, - bullets, **bold**) into clean HTML
function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
      : p
  );
}

function renderBody(body: string) {
  return body.split('\n\n').map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Subheading: lines starting with # through ######
    if (/^#{1,6}\s+/.test(trimmed)) {
      return (
        <h2 key={i} className="font-[family-name:var(--font-lora)] text-lg sm:text-xl font-bold text-gray-900 mt-8 mb-4">
          {inlineFormat(trimmed.replace(/^#{1,6}\s+/, ''))}
        </h2>
      );
    }

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);

    // Bulleted list: every line starts with -, *, or •
    if (lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l))) {
      return (
        <ul key={i} className="list-disc pl-6 mb-6 space-y-2 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
          {lines.map((l, j) => <li key={j}>{inlineFormat(l.replace(/^[-*•]\s+/, ''))}</li>)}
        </ul>
      );
    }

    // Numbered list: every line starts with 1. or 1)
    if (lines.length > 0 && lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      return (
        <ol key={i} className="list-decimal pl-6 mb-6 space-y-2 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
          {lines.map((l, j) => <li key={j}>{inlineFormat(l.replace(/^\d+[.)]\s+/, ''))}</li>)}
        </ol>
      );
    }

    return (
      <p key={i} className="mb-5 text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
        {inlineFormat(trimmed)}
      </p>
    );
  });
}

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [related, setRelated] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const articleId = id as string;
    // Check static articles
    const sa = newsArticles.find(a => a.id === articleId);
    if (sa) {
      setArticle(sa);
      setRelated(newsArticles.filter(a => a.category === sa.category && a.id !== articleId).slice(0, 4));
      setLoading(false);
      return;
    }
    // Fetch this single pipeline article (fast — one small request, not the whole list)
    fetch(`/api/articles?id=${encodeURIComponent(articleId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.article) {
          setArticle(data.article);
          setRelated(data.related ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full" />
    </div>
  );

  if (!article) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-white">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Article Not Found</h1>
      <p className="text-gray-500 mb-6">The article you're looking for doesn't exist.</p>
      <Link href="/" className="text-red-600 hover:underline font-medium inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to News</Link>
    </div>
  );

  // ★ Read credit info (cast keeps this safe regardless of the NewsArticle type)
  const creditName = (article as any).imageCreditName as string | null | undefined;
  const creditUrl = (article as any).imageCreditUrl as string | null | undefined;

  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-dm-sans)] bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0f1b3d] active:text-[#0f1b3d] transition-colors py-2 px-2 -ml-2 rounded-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to News</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <div className="flex-1" />
          <Link href="/" className="font-[family-name:var(--font-lora)] font-bold text-[#0f1b3d] text-lg hidden sm:block">NewsShore</Link>
          <div className="flex-1 sm:flex-none" />
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
            className="text-gray-400 hover:text-red-600 transition-colors p-2" aria-label="Share">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Image */}
        <div className="relative w-full aspect-[21/9] sm:aspect-[21/8]">
          <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Link href={`/${article.category === 'AI News' ? 'ai-news' : article.category === 'Tech Giants' ? 'tech-giants' : article.category === 'Tech News' ? 'tech-news' : article.category === 'Startups & Funding' ? 'startups-funding' : article.category === 'Research' ? 'research' : article.category === 'Global & China' ? 'global-china' : ''}`}>
                <Badge className={`${CATEGORY_COLOR[article.category] || 'bg-gray-100 text-gray-700'} text-xs hover:opacity-80 cursor-pointer`}>{article.category}</Badge>
              </Link>
              <ReliabilityBadge r={article.reliability} />
            </div>
            <h1 className="font-[family-name:var(--font-lora)] text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">{article.title}</h1>
          </div>
        </div>

        {/* Article Body */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 py-6 sm:py-8">
          {/* ★ Photo credit — required by Unsplash guidelines */}
          {creditName && (
            <p className="text-xs text-gray-400 font-[family-name:var(--font-dm-sans)] mb-4">
              Photo by{' '}
              <a href={creditUrl ?? 'https://unsplash.com'} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">{creditName}</a>{' '}
              on{' '}
              <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Unsplash</a>
            </p>
          )}

          {/* Meta Bar */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pb-5 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400"><Clock className="w-3 h-3" />{formatDate(article.publishedAt)}</div>
            <Badge variant="outline" className="text-[10px] sm:text-xs border-gray-200 text-gray-500 gap-1"><Globe className="w-3 h-3" /> {article.region}</Badge>
            <span className="text-[10px] sm:text-xs text-gray-400">{getReadTime(article.body || article.summary)} min read</span>
          </div>

          {/* Summary */}
          <p className="mt-5 text-base sm:text-lg lg:text-xl text-gray-700 leading-relaxed font-medium">{article.summary}</p>

          {/* Body */}
          <div className="mt-5">
            {renderBody(article.body || '')}
          </div>

          {/* Source */}
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Source:</span>
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline font-medium inline-flex items-center gap-1">
              {article.sourceName}<ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Glossary */}
          {article.glossary?.length > 0 && (
            <div className="rounded-lg p-4 sm:p-5 mt-6 bg-gray-50 border border-gray-100">
              <h3 className="text-red-600 font-bold font-[family-name:var(--font-lora)] text-base sm:text-lg mb-3">Understand This Story</h3>
              <div className="space-y-3">
                {article.glossary.map((item: { term: string; definition: string }, i: number) => (
                  <div key={i}>
                    <p className="font-semibold text-gray-900 text-sm">{item.term}</p>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{item.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Stories */}
          {related.length > 0 && (
            <div className="mt-10">
              <Separator className="mb-8" />
              <h3 className="font-[family-name:var(--font-lora)] text-lg font-bold text-gray-900 mb-4">Related Stories</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {related.map(a => (
                  <Link key={a.id} href={`/article/${a.id}`} className="text-left p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group">
                    <Badge className={`${CATEGORY_COLOR[a.category] || 'bg-gray-100 text-gray-700'} text-[10px] mb-1.5`}>{a.category}</Badge>
                    <p className="font-[family-name:var(--font-lora)] text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(a.publishedAt)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-100 bg-gray-50 py-6 px-4 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} NewsShore. All rights reserved.
      </footer>
    </div>
  );
}
