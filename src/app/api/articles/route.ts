import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Slim mapping — same shape the homepage server-renders. No full bodies in lists.
function mapSlim(a: any) {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary ?? '',
    body: '',
    category: a.category,
    region: a.region,
    sourceUrl: a.sourceUrl,
    sourceName: a.sourceName ?? '',
    reliability: a.reliability,
    publishedAt: a.createdAt.toISOString(),
    image: a.imageUrl ?? '/news-images/claude-today-1.jpg',
    imageCreditName: a.imageCreditName ?? null,
    imageCreditUrl: a.imageCreditUrl ?? null,
    readMinutes: Math.max(1, Math.ceil(((a.body ?? '').length / 5) / 250)),
    glossary: Array.isArray(a.glossary) ? a.glossary : [],
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // ---- Single article + related (used by the article page) — full body included ----
    if (id) {
      const row = await db.article.findUnique({ where: { id } });
      if (!row) {
        return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
      }
      const relatedRows = await db.article.findMany({
        where: { category: row.category, NOT: { id: row.id } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      });
      const article = { ...mapSlim(row), body: row.body ?? '' };
      return NextResponse.json({ success: true, article, related: relatedRows.map(mapSlim) });
    }

    // ---- Full list (slim) — homepage background refresh + your console checks ----
    const total = await db.article.count();
    const rows = await db.article.findMany({
      orderBy: { createdAt: 'desc' },
      take: total,
    });
    const articles = rows
      .filter((a) => (a.title ?? '').trim().length > 0)
      .map(mapSlim);

    return NextResponse.json({ success: true, total: articles.length, articles });
  } catch (err) {
    console.error('[articles] fetch error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch articles' }, { status: 500 });
  }
}
