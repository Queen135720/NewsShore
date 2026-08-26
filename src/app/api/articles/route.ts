import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const articles = await db.article.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const mapped = articles.map((a) => ({
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

    return NextResponse.json({ success: true, articles: mapped });
  } catch (err) {
    console.error('[articles] fetch error:', err);
    return NextResponse.json({ success: true, articles: [] });
  }
}
