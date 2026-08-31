'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, TrendingUp, Globe, Trophy, Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-dm-sans)] bg-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0f1b3d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to News</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo-full-transparent.png" alt="NewsShore" className="h-7 sm:h-9 w-auto object-contain" />
          </div>
          <h1 className="font-[family-name:var(--font-lora)] text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">About NewsShore</h1>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
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
              <a href="https://t.me/News_Shore" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors text-sm font-medium"><Send className="w-4 h-4" /> Telegram</a>
              <a href="https://whatsapp.com/channel/0029Vb8MT8c002THGmdgsd32" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> WhatsApp</a>
              <a href="https://web.facebook.com/profile.php?id=61592735245077" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Facebook</a>
            </div>
          </div>
          <div className="text-center text-sm text-gray-400 py-8">&copy; 2026 NewsShore. All rights reserved.</div>
        </div>
      </main>

      <footer className="mt-auto border-t border-gray-100 bg-gray-50 py-6 px-4 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} NewsShore. All rights reserved.
      </footer>
    </div>
  );
}
