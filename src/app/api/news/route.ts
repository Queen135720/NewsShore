import { NextResponse } from "next/server";
import { newsArticles, breakingNews, categories, trendingArticles } from "@/lib/news-data";

export async function GET() {
  return NextResponse.json({
    articles: newsArticles,
    breakingNews,
    categories,
    trendingArticles,
  });
}
