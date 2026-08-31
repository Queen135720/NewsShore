import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SLUG_TO_CATEGORY: Record<string, string> = {
  'ai-news': 'AI News',
  'tech-giants': 'Tech Giants',
  'tech-news': 'Tech News',
  'startups-funding': 'Startups & Funding',
  'research': 'Research',
  'deals': 'Deals',
  'global-china': 'Global & China',
};

export function middleware(request: NextRequest) {
  const slug = request.nextUrl.pathname.slice(1);
  if (SLUG_TO_CATEGORY[slug]) {
    const url = request.nextUrl.clone();
    url.searchParams.set('cat', SLUG_TO_CATEGORY[slug]);
    url.pathname = '/';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/ai-news', '/tech-giants', '/tech-news', '/startups-funding', '/research', '/deals', '/global-china'],
};
