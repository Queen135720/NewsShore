import { NextRequest, NextResponse } from 'next/server';

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const perPage = request.nextUrl.searchParams.get('per_page') || '5';
  const orientation = request.nextUrl.searchParams.get('orientation') || 'landscape';

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`,
    {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      next: { revalidate: 86400 },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Unsplash API error' }, { status: res.status });
  }

  const data = await res.json();
  const results = data.results.map((r: { id: string; urls: { regular: string; thumb: string }; description: string | null; alt_description: string | null; user: { name: string } }) => ({
    id: r.id,
    url: r.urls.regular,
    thumb: r.urls.thumb,
    description: r.description || r.alt_description || '',
    photographer: r.user.name,
  }));

  return NextResponse.json({ results });
}
