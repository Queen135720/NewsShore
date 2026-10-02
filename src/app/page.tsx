import { Suspense } from 'react';
import { db } from '@/lib/db';
import { Home } from './home-view';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const total = await db.article.count();

  const rows = await db.article.findMany({
    orderBy: { createdAt: 'desc' },
    take: total,
  });

  const articles = rows
    .filter((a) => (a.title ?? '').trim().length > 0)
    .map((a) => ({
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
    }));

  return (
    <Suspense fallback={(
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full" />
      </div>
    )}>
      <Home initialArticles={articles as any} />
    </Suspense>
  );
}
