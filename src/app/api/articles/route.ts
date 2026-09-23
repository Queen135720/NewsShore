import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const total = await db.article.count();

    const rows = await db.article.findMany({
      orderBy: { createdAt: 'desc' },
      take: total,
    });

    // Filter out junk rows (empty titles) so they never render
    const articles = rows
      .filter((a) => (a.title ?? '').trim().length > 0)
      .map((a) => ({
        id: a.id.toString(),
        title: a.title,
        summary: a.summary ?? '',
        body: a.body ?? '',
        category: a.category,
        region: a.region,
        sourceUrl: a.sourceUrl,
        sourceName: a.sourceName ?? '',
        reliability: a.reliability as 'verified' | 'claimed',
        publishedAt: a.createdAt.toISOString(),
        image: a.imageUrl ?? '/news-images/claude-today-1.jpg',
        glossary: Array.isArray(a.glossary) ? a.glossary : [],
      }));

    return NextResponse.json({ success: true, total: articles.length, articles });
  } catch (err) {
    console.error('[articles] fetch error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
