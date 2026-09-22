import { writeFileSync, mkdirSync } from 'fs';
const UNSPLASH_ACCESS_KEY = 'yK5YCoU4Tgo1dKbB7Ob-8ddbPyZA6u8pDmhD6d_JZrU';

const TOPICS = [
  'Claude 4 Opus coding assistant vs human programmer',  'Claude 4 enterprise adoption rising across industries', 'Claude 4 open weights versus closed source models', 'Mistral NeMo model releases new features for developers', 'Google Gemini Pro 2.5 reasoning breakthrough', 'Meta Llama 4 release open weights', 'OpenAI GPT-5 advanced reasoning model', 'DeepSeek V3 open model challenges GPT', 'AI model performance benchmark comparison 2026', 'Anthropic Claude Computer Use agent automation' ];
const DIR = '/home/z/my-project/public/news-images/';
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
for (let i = 0; i < TOPICS.length; i++) {
  const file = TOPICS[i];  console.log(`  [${i+1}] Downloading: ${file.query}`); const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(file.query)}&per_page=1&orientation=landscape`, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
  if (!res.ok) { console.error(`  ${file.query} failed`); continue; }
  const img = data.results[0];  const buf = Buffer.from(await res.arrayBuffer());  writeFileSync(join(DIR, file), buf);  console.log('  ✓ ' + file);\n  await new Promise(r => setTimeout(r, 1500));\n  console.log();\n}