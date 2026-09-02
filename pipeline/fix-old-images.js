// ONE-TIME CLEANUP SCRIPT — re-fetches images for articles already saved,
// using the corrected image logic (no watermarked premium photos, no repeats,
// no brand-name mismatches). Run this once, then it can be deleted.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Same corrected function from fetch-and-publish.js
async function fetchImage(headline, category) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;
  const contextWord = { 'AI News': 'technology', 'Research': 'science', 'Startups & Funding': 'business',
    'Tech Giants': 'technology', 'Tech News': 'technology', 'Global & China': 'technology' }[category] || 'technology';
  const query = encodeURIComponent(`${headline.split(' ').slice(0, 6).join(' ')} ${contextWord}`);
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=10&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const freeResults = (data.results || []).filter(r => !r.premium);
    if (freeResults.length === 0) return null;
    const pick = freeResults[Math.floor(Math.random() * Math.min(5, freeResults.length))];
    return pick?.urls?.regular || null;
  } catch {
    return null;
  }
}

async function run() {
  console.log('Fetching all existing articles...');
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, category');

  if (error) {
    console.error('Failed to fetch articles:', error.message);
    return;
  }

  console.log(`Found ${articles.length} articles to update.`);

  // Unsplash free tier allows 50 requests/hour — pace ourselves well under that
  // (about 1 every 75 seconds keeps you safely under the limit even with retries)
  for (const article of articles) {
    const newImage = await fetchImage(article.title, article.category);
    if (newImage) {
      const { error: updateError } = await supabase
        .from('articles')
        .update({ image_url: newImage })
        .eq('id', article.id);
      if (updateError) {
        console.error(`Failed to update "${article.title}":`, updateError.message);
      } else {
        console.log(`Updated: ${article.title}`);
      }
    } else {
      console.log(`No image found for: ${article.title} (leaving as-is)`);
    }
    await sleep(75000); // ~75 seconds between requests to stay well under 50/hour
  }

  console.log('Cleanup complete.');
}

run();
