import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const UNSPLASH_ACCESS_KEY = 'yK5YCoU4Tgo1dKbB7Ob-8ddbPyZA6u8pDmhD6d_JZrU';

const ARTICLE_QUERIES: [string, string][] = [
  ['anthropic-files-confidentially-for-ipo-targets-october-listi', 'stock market trading floor wall street'],
  ['openai-and-anthropic-swallow-43-of-all-h1-2026-startup-fundi', 'venture capital funding startup investment'],
  ['mit-and-stanford-self-correction-matters-more-than-model-siz', 'artificial intelligence research laboratory'],
  ['deepmind-s-new-training-method-improves-multi-step-coding-ta', 'computer programming code screen developer'],
  ['anthropic-heads-toward-ipo-on-the-back-of-47b-run-rate', 'AI technology company modern office'],
  ['tsmc-posts-record-revenue-as-ai-chip-demand-keeps-climbing', 'semiconductor chip manufacturing factory clean room'],
  ['nvidia-unveils-new-superchip-built-for-personal-ai-agents', 'nvidia computer chip GPU technology'],
  ['china-weighs-new-restrictions-on-overseas-ai-access', 'great wall of china digital technology internet'],
  ['african-startups-raise-1-44-billion-in-h1-2026-led-by-clean-', 'africa tech startup innovation Nairobi city'],
  ['southeast-asia-tech-funding-doubles-to-7-4b-but-one-company-', 'singapore skyline modern city data center'],
  ['ai-industry-tracks-335-model-releases-as-pace-of-launches-ac', 'artificial intelligence neural network visualization'],
  ['india-s-sarvam-ai-joins-the-unicorn-club-with-234m-raise', 'India technology startup Bangalore office'],
  ['deepseek-reportedly-seeks-7-4b-raise-asks-investors-not-to-p', 'AI research China technology lab'],
  ['ai-captures-81-of-a-record-297b-venture-capital-quarter', 'money investment finance charts graphs'],
  ['microsoft-and-google-chase-anthropic-and-openai-in-ai-coding', 'software development coding multiple screens'],
  ['anthropic-raises-65b-at-near-1t-valuation-ahead-of-expected-', 'IPO stock exchange bell ringing wall street'],
  ['deepseek-unveils-v4-preview-doubling-down-on-open-weights', 'open source software community collaboration'],
  ['anthropic-cursor-backer-accel-raises-5-billion-for-more-ai-b', 'venture capital firm office meeting'],
  ['stanford-s-2026-ai-index-shows-benchmark-scores-nearly-doubl', 'Stanford University campus research'],
  ['mistral-ai-deepens-war-chest-with-asml-backing-and-paris-data', 'Paris France city skyline technology'],
  ['anthropic-raises-30b-series-g-valuation-hits-380b', 'AI startup office modern workspace team'],
  ['grok-overtakes-deepseek-as-third-biggest-ai-chatbot-by-traffic', 'social media app smartphone screen chatbot'],
  ['anthropic-releases-open-source-automation-plugins-for-claude-cowork', 'AI automation workflow productivity office'],
  ['are-ai-models-actually-profitable-epoch-ai-investigates', 'profit loss financial report business analytics'],
  ['microsoft-deepens-ties-with-anthropic-after-openai-deal-finalized', 'corporate partnership handshake business deal'],
  ['openai-adds-age-verification-to-chatgpt', 'AI chat interface screen conversation technology'],
  ['musk-s-lawsuit-against-openai-heads-to-trial', 'courtroom law gavel legal trial justice'],
  ['xai-closes-20-billion-round-merges-interests-with-spacex', 'SpaceX rocket launch space technology'],
];

const OUT_DIR = join(process.cwd(), 'public', 'news-images');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function downloadImage(url: string, filePath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(filePath, buffer);
    console.log(`  ✓ ${filePath.split('/').pop()} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (e) {
    console.error(`  ✗ Failed:`, (e as Error).message);
    return false;
  }
}

async function main() {
  console.log(`Downloading ${ARTICLE_QUERIES.length} unique images from Unsplash...\n`);
  for (const [slug, query] of ARTICLE_QUERIES) {
    const filePath = join(OUT_DIR, `${slug}.jpg`);
    if (existsSync(filePath)) {
      console.log(`  ⊘ Skipped ${slug.substring(0, 40)}...`);
      continue;
    }
    console.log(`  → "${query}"`);
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) { console.error('  ✗ API error'); continue; }
    const data = await res.json();
    if (!data.results?.length) { console.error('  ✗ No results'); continue; }
    await downloadImage(data.results[0].urls.regular, filePath);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('\nDone!');
}

main();
