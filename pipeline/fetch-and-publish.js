// NewsShore automation pipeline
// 1) checks RSS feeds for new articles
// 2) rewrites with AI (Gemini → GLM → Groq → DeepSeek fallback chain)
// 3) saves to Supabase for the website to display
//
// Image system:
//   - AI generates visual search queries during the rewrite (no brand names)
//   - Unsplash searched with quality floor + no repeats (dedup vs last 300 articles)
//   - never falls back to source-article images (that was the Alamy watermark leak)

import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';

const providerDown = { glm: false, groq: false, cloudflare: false, groq20b: false, Bazaar: false, eden: false, chutes: false, novita: false, apinex: false, nvidia: false, nvidia2: false, gemini: false,};

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'NewsShore-Bot/1.0 (https://newsshore.com)',
    Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  },
  customFields: {
    item: ['media:content', 'media:thumbnail'],
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ---- 1. SOURCES ----
// sources_merged.js — SOURCES for fetch-and-publish.js (generated 2026-11-23)
// Your 42 originals (unchanged, comments updated) + 104 new feeds
// from the research bundle = 146 total, deduped by feed URL.
// Paste the array into fetch-and-publish.js, or:  const { SOURCES } = require('./sources_merged');

const SOURCES = [
  // ============ AI News ============
  // ---- your 5 originals ----
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", category: "AI News", region: "US" },  // also in research bundle (deduped)
  { name: "Google Research", url: "https://research.google/blog/rss/", category: "AI News", region: "US" },  // RENAMED from "Google DeepMind" — this URL is the Google Research blog; the real DeepMind feed is added below
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", category: "AI News", region: "Global" },  // also in research bundle (deduped)
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", category: "AI News", region: "Global" },  // also in research bundle (deduped)
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", category: "AI News", region: "US" },
  // ---- 38 new from the research bundle ----
  { name: "Amazon Science", url: "https://www.amazon.science/index.rss", category: "AI News", region: "US" },
  { name: "Apple Machine Learning", url: "https://machinelearning.apple.com/rss.xml", category: "AI News", region: "US" },
  { name: "Google (The Keyword)", url: "https://blog.google/rss/", category: "AI News", region: "US" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", category: "AI News", region: "UK" },
  { name: "Meta Engineering", url: "https://engineering.fb.com/feed/", category: "AI News", region: "US" },
  { name: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/", category: "AI News", region: "US" },
  { name: "Mistral AI", url: "https://mistral.ai/news/rss", category: "AI News", region: "France" },
  { name: "NVIDIA", url: "https://blogs.nvidia.com/feed/", category: "AI News", region: "US" },
  { name: "Qwen (Alibaba)", url: "https://qwenlm.github.io/blog/index.xml", category: "AI News", region: "China" },
  { name: "Stability AI", url: "https://stability.ai/news-updates?format=rss", category: "AI News", region: "UK" },
  { name: "CENIA (Chile national AI centre)", url: "https://cenia.cl/feed/", category: "AI News", region: "Chile" },
  { name: "Deep Learning Indaba", url: "https://deeplearningindaba.com/feed/", category: "AI News", region: "Africa" },
  { name: "Sarvam AI", url: "https://www.sarvam.ai/rss.xml", category: "AI News", region: "India" },
  { name: "Epoch AI", url: "https://epoch.ai/atom.xml", category: "AI News", region: "US" },
  { name: "Last Week in AI", url: "https://lastweekin.ai/feed", category: "AI News", region: "Global" },
  { name: "The Rundown AI", url: "https://www.therundown.ai/feed", category: "AI News", region: "US" },
  { name: "GN: Anthropic", url: "https://news.google.com/rss/search?q=Anthropic%20OR%20Claude&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: DeepSeek", url: "https://news.google.com/rss/search?q=DeepSeek&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "China" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Moonshot AI / Kimi", url: "https://news.google.com/rss/search?q=Moonshot%20AI%20OR%20Kimi&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "China" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Z.ai (Zhipu GLM)", url: "https://news.google.com/rss/search?q=Z.ai%20OR%20Zhipu%20OR%20GLM&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "China" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Meta AI", url: "https://news.google.com/rss/search?q=Meta%20AI%20Llama&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: xAI", url: "https://news.google.com/rss/search?q=xAI%20OR%20Grok&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Sakana AI", url: "https://news.google.com/rss/search?q=Sakana%20AI&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "Japan" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Aleph Alpha", url: "https://news.google.com/rss/search?q=Aleph%20Alpha%20AI&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "Germany" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Black Forest Labs", url: "https://news.google.com/rss/search?q=Black%20Forest%20Labs%20OR%20FLUX%20model&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Cohere", url: "https://news.google.com/rss/search?q=Cohere%20AI&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Shanghai AI Laboratory", url: "https://news.google.com/rss/search?q=Shanghai%20AI%20Laboratory&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "China" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: ByteDance Seed", url: "https://news.google.com/rss/search?q=ByteDance%20Seed%20research&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "China" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: CSIRO Data61", url: "https://news.google.com/rss/search?q=CSIRO%20Data61&hl=en-AU&gl=AU&ceid=AU:en", category: "AI News", region: "Australia" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Stanford HAI", url: "https://news.google.com/rss/search?q=Stanford%20HAI&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: MIT CSAIL", url: "https://news.google.com/rss/search?q=MIT%20CSAIL&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Mila", url: "https://news.google.com/rss/search?q=Mila%20AI%20Montreal&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "Canada" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Vector Institute", url: "https://news.google.com/rss/search?q=Vector%20Institute%20AI%20Toronto&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "Canada" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Masakhane / African AI research", url: "https://news.google.com/rss/search?q=Masakhane%20OR%20AI4D%20artificial%20intelligence%20Africa&hl=en-ZA&gl=ZA&ceid=ZA:en", category: "AI News", region: "Africa" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Sarvam / India AI labs", url: "https://news.google.com/rss/search?q=Sarvam%20AI%20OR%20AI4Kashesh%20OR%20Krutrim&hl=en-IN&gl=IN&ceid=IN:en", category: "AI News", region: "India" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Moonshot AI (US edition)", url: "https://news.google.com/rss/search?q=Moonshot%20AI&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News regional edition
  { name: "GN: Anthropic (US edition)", url: "https://news.google.com/rss/search?q=Anthropic&hl=en-US&gl=US&ceid=US:en", category: "AI News", region: "US" },  // Google News regional edition

  // ============ Tech Giants ============
  // ---- your 3 originals ----
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", category: "Tech Giants", region: "Global" },  // also in research bundle (deduped)
  { name: "Ethan Mollick", url: "https://www.oneusefulthing.org/feed", category: "Tech Giants", region: "US" },  // verified OK
  { name: "Andrej Karpathy", url: "https://karpathy.github.io/feed.xml", category: "Tech Giants", region: "US" },  // verified OK — posts only a few times a year
  // ---- 5 new from the research bundle ----
  { name: "Ahead of AI (Sebastian Raschka)", url: "https://magazine.sebastianraschka.com/feed", category: "Tech Giants", region: "US" },
  { name: "Import AI (Jack Clark)", url: "https://importai.substack.com/feed", category: "Tech Giants", region: "US" },
  { name: "Interconnects (Nathan Lambert)", url: "https://www.interconnects.ai/feed", category: "Tech Giants", region: "US" },
  { name: "Latent Space", url: "https://latent.space/feed", category: "Tech Giants", region: "US" },
  { name: "Sam Altman (personal blog)", url: "https://blog.samaltman.com/posts.atom", category: "Tech Giants", region: "US" },

  // ============ Tech News ============
  // ---- your 13 originals ----
  { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/", category: "Tech News", region: "US" },  // verified OK — Ars AI section feed
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech News", region: "Global" },
  { name: "TechCrunch Robotics", url: "https://techcrunch.com/category/robotics/feed/", category: "Tech News", region: "Global" },
  { name: "TechCrunch Space", url: "https://techcrunch.com/category/space/feed/", category: "Tech News", region: "Global" },
  { name: "TechCrunch Security", url: "https://techcrunch.com/category/security/feed/", category: "Tech News", region: "Global" },
  { name: "TechCrunch Hardware", url: "https://techcrunch.com/category/hardware/feed/", category: "Tech News", region: "Global" },
  { name: "TechCrunch Gadgets", url: "https://techcrunch.com/category/gadgets/feed/", category: "Tech News", region: "Global" },
  { name: "TechCrunch Europe", url: "https://techcrunch.com/tag/europe/feed/", category: "Tech News", region: "Europe" },
  { name: "TechCrunch Asia", url: "https://techcrunch.com/tag/asia/feed/", category: "Tech News", region: "Asia" },
  { name: "The Robot Report", url: "https://www.therobotreport.com/feed/", category: "Tech News", region: "Global" },  // probe-confirmed: Cloudflare 403 from servers — your fetcher should skip failures silently
  { name: "IEEE Spectrum Robotics", url: "https://spectrum.ieee.org/feeds/topic/robotics.rss", category: "Tech News", region: "Global" },  // verified OK
  { name: "Robotics Business Review", url: "https://www.roboticsbusinessreview.com/feed/", category: "Tech News", region: "Global" },  // probe-confirmed: Cloudflare 403 from servers — expect silent failures
  // ---- 20 new from the research bundle ----
  { name: "Berkeley BAIR blog", url: "https://bair.berkeley.edu/blog/feed.xml", category: "Tech News", region: "US" },
  { name: "CMU Robotics Institute", url: "https://www.ri.cmu.edu/feed/", category: "Tech News", region: "US" },
  { name: "NASA JPL", url: "https://www.nasa.gov/news-release/feed/", category: "Tech News", region: "US" },
  { name: "Open Robotics", url: "https://www.openrobotics.org/blog?format=rss", category: "Tech News", region: "US" },
  { name: "ROS Discourse", url: "https://discourse.openrobotics.org/latest.rss", category: "Tech News", region: "Global" },
  { name: "Robohub", url: "https://robohub.org/feed/", category: "Tech News", region: "Global" },
  { name: "Science Robotics (TOC)", url: "https://www.science.org/action/showFeed?jcCode=robotics&type=etoc&feed=rss", category: "Tech News", region: "US" },
  { name: "Bing News (AI, RSS)", url: "https://www.bing.com/news/search?q=artificial+intelligence&format=RSS", category: "Tech News", region: "Global" },
  { name: "Hacker News (hnrss, AI filter)", url: "https://hnrss.org/frontpage", category: "Tech News", region: "Global" },
  { name: "MIT Tech Review (AI topic)", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", category: "Tech News", region: "Global" },
  { name: "MarkTechPost", url: "https://www.marktechpost.com/feed/", category: "Tech News", region: "Global" },
  { name: "Techmeme", url: "https://www.techmeme.com/feed.xml", category: "Tech News", region: "US" },
  { name: "The Verge (AI tag)", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", category: "Tech News", region: "Global" },
  { name: "GN: Boston Dynamics", url: "https://news.google.com/rss/search?q=Boston%20Dynamics&hl=en-US&gl=US&ceid=US:en", category: "Tech News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Figure AI", url: "https://news.google.com/rss/search?q=Figure%20AI%20robot%20OR%20Figure%2003&hl=en-US&gl=US&ceid=US:en", category: "Tech News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Unitree Robotics", url: "https://news.google.com/rss/search?q=Unitree&hl=en-US&gl=US&ceid=US:en", category: "Tech News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Tesla Optimus", url: "https://news.google.com/rss/search?q=Tesla%20Optimus%20robot&hl=en-US&gl=US&ceid=US:en", category: "Tech News", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Toyota Research Institute", url: "https://news.google.com/rss/search?q=Toyota%20Research%20Institute&hl=en-US&gl=US&ceid=US:en", category: "Tech News", region: "US" },  // Google News query feed — links are news.google.com redirects

  // ============ Mobile & Social ============
  // ---- your 6 originals ----
  { name: "9to5Google", url: "https://9to5google.com/feed/", category: "Mobile & Social", region: "US" },
  { name: "TechCrunch Apps", url: "https://techcrunch.com/category/apps/feed/", category: "Mobile & Social", region: "Global" },
  { name: "TechCrunch Social", url: "https://techcrunch.com/category/social/feed/", category: "Mobile & Social", region: "Global" },
  { name: "TechCrunch Mobile", url: "https://techcrunch.com/tag/mobile/feed/", category: "Mobile & Social", region: "Global" },
  { name: "TechCrunch Media & Entertainment", url: "https://techcrunch.com/category/media-entertainment/feed/", category: "Mobile & Social", region: "Global" },
  { name: "Social Media Examiner", url: "https://www.socialmediaexaminer.com/feed/", category: "Mobile & Social", region: "Global" },

  // ============ Startups & Funding ============
  // ---- your 5 originals ----
  { name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/", category: "Startups & Funding", region: "Global" },
  { name: "TechCrunch Funding", url: "https://techcrunch.com/tag/funding/feed/", category: "Startups & Funding", region: "Global" },
  { name: "TechCrunch Venture", url: "https://techcrunch.com/category/venture/feed/", category: "Startups & Funding", region: "Global" },
  { name: "TechCrunch Enterprise", url: "https://techcrunch.com/category/enterprise/feed/", category: "Startups & Funding", region: "Global" },
  { name: "TechCrunch Fintech", url: "https://techcrunch.com/category/fintech/feed/", category: "Startups & Funding", region: "Global" },

  // ============ Deals ============
  // ---- your 1 original ----
  { name: "TechCrunch Deals", url: "https://techcrunch.com/tag/deals/feed/", category: "Deals", region: "Global" },  // valid tag feed

  // ============ Research ============
  // ---- your 4 originals ----
  { name: "MIT News AI", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", category: "Research", region: "US" },
  { name: "Nature Tech", url: "https://www.nature.com/subjects/technology.rss", category: "Research", region: "Global" },
  { name: "Quantum Computing Report", url: "https://quantumcomputingreport.com/news/feed/", category: "Research", region: "Global" },
  { name: "Inside Quantum Technology", url: "https://insidequantumtechnology.com/feed/", category: "Research", region: "Global" },
  { name: "IBM Research", url: "https://research.ibm.com/rss", category: "Research", region: "US" },
  // ---- 26 new from the research bundle ----
  // (quantum industry feeds + arXiv/journal paper streams, as requested)
  { name: "MIT Tech Review (quantum topic)", url: "https://www.technologyreview.com/topic/quantum-computing/feed/", category: "Research", region: "Global" },
  { name: "Microsoft (Azure) Quantum", url: "https://azure.microsoft.com/en-us/blog/feed/", category: "Research", region: "US" },
  { name: "Pasqal", url: "https://www.pasqal.com/feed/", category: "Research", region: "France" },
  { name: "Physics World (quantum)", url: "https://physicsworld.com/feed/", category: "Research", region: "UK" },  // may 403 (Cloudflare) from servers
  { name: "QuTech", url: "https://qutech.nl/feed/", category: "Research", region: "Netherlands" },
  { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", category: "Research", region: "US" },
  { name: "Quantum Zeitgeist", url: "https://quantumzeitgeist.com/feed/", category: "Research", region: "Global" },  // may 403 (Cloudflare) from servers
  { name: "ScienceDaily (quantum)", url: "https://www.sciencedaily.com/rss/matter_energy/quantum_physics.xml", category: "Research", region: "Global" },
  { name: "The Quantum Insider", url: "https://thequantuminsider.com/feed/", category: "Research", region: "Global" },
  { name: "Nature Machine Intelligence (TOC)", url: "https://www.nature.com/natmachintell.rss", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "arXiv cs.AI (RSS)", url: "https://export.arxiv.org/rss/cs.AI", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "arXiv cs.CL (RSS)", url: "https://export.arxiv.org/rss/cs.CL", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "arXiv cs.LG (RSS)", url: "https://export.arxiv.org/rss/cs.LG", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "arXiv cs.RO (RSS)", url: "https://export.arxiv.org/rss/cs.RO", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "arXiv quant-ph (RSS)", url: "https://export.arxiv.org/rss/quant-ph", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "npj Quantum Information (TOC)", url: "https://www.nature.com/npjqi.rss", category: "Research", region: "Global" },  // paper stream — arXiv listing feed (no summary text), updates ~daily
  { name: "GN: Quantinuum", url: "https://news.google.com/rss/search?q=Quantinuum&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: IonQ", url: "https://news.google.com/rss/search?q=IonQ&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: PsiQuantum", url: "https://news.google.com/rss/search?q=PsiQuantum&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Google Quantum AI", url: "https://news.google.com/rss/search?q=Google%20quantum%20computer&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: QuEra", url: "https://news.google.com/rss/search?q=QuEra%20quantum&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Rigetti", url: "https://news.google.com/rss/search?q=Rigetti%20quantum&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: IQM Quantum", url: "https://news.google.com/rss/search?q=IQM%20quantum&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Xanadu", url: "https://news.google.com/rss/search?q=Xanadu%20quantum%20OR%20PennyLane&hl=en-US&gl=US&ceid=US:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: Silicon Quantum Computing", url: "https://news.google.com/rss/search?q=Silicon%20Quantum%20Computing%20Australia&hl=en-AU&gl=AU&ceid=AU:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects
  { name: "GN: CQT Singapore", url: "https://news.google.com/rss/search?q=Centre%20for%20Quantum%20Technologies%20Singapore&hl=en-SG&gl=SG&ceid=SG:en", category: "Research", region: "US" },  // Google News query feed — links are news.google.com redirects

  // ============ Global Tech ============
  // ---- your 5 originals ----
  { name: "Rest of World", url: "https://restofworld.org/feed/latest/", category: "Global Tech", region: "Global" },
  { name: "TechCabal", url: "https://techcabal.com/feed/", category: "Global Tech", region: "Nigeria" },
  { name: "TechCentral ZA", url: "https://techcentral.co.za/feed/", category: "Global Tech", region: "South Africa" },
  { name: "e27", url: "https://e27.co/feed/", category: "Global Tech", region: "Singapore" },
  { name: "TechNode", url: "https://technode.com/feed/", category: "Global Tech", region: "China" },
  // ---- 15 new from the research bundle ----
  { name: "GN: AI news (India edition)", url: "https://news.google.com/rss/search?q=artificial%20intelligence&hl=en-IN&gl=IN&ceid=IN:en", category: "Global Tech", region: "India" },  // Google News regional edition
  { name: "GN: Robotics (Australia edition)", url: "https://news.google.com/rss/search?q=robotics&hl=en-AU&gl=AU&ceid=AU:en", category: "Global Tech", region: "Australia" },  // Google News regional edition
  { name: "GN: AI & robots (Japan edition)", url: "https://news.google.com/rss/search?q=AI%20%E3%83%AD%E3%83%9C%E3%83%83%E3%83%88&hl=ja&gl=JP&ceid=JP:ja", category: "Global Tech", region: "Japan" },  // Google News regional edition
  { name: "GN: AI news (South Africa edition)", url: "https://news.google.com/rss/search?q=artificial%20intelligence&hl=en-ZA&gl=ZA&ceid=ZA:en", category: "Global Tech", region: "South Africa" },  // Google News regional edition
  { name: "GN: AI news (Kenya edition)", url: "https://news.google.com/rss/search?q=artificial%20intelligence&hl=en-KE&gl=KE&ceid=KE:en", category: "Global Tech", region: "Kenya" },  // Google News regional edition
  { name: "GN: AI news (Nigeria edition)", url: "https://news.google.com/rss/search?q=artificial%20intelligence&hl=en-NG&gl=NG&ceid=NG:en", category: "Global Tech", region: "Nigeria" },  // Google News regional edition
  { name: "GN: Humanoid robots (US edition)", url: "https://news.google.com/rss/search?q=humanoid%20robot&hl=en-US&gl=US&ceid=US:en", category: "Global Tech", region: "US" },  // Google News regional edition
  { name: "GN: Quantum computing (US edition)", url: "https://news.google.com/rss/search?q=quantum%20computing&hl=en-US&gl=US&ceid=US:en", category: "Global Tech", region: "US" },  // Google News regional edition
  { name: "GN: AI news (Singapore edition)", url: "https://news.google.com/rss/search?q=artificial%20intelligence&hl=en-SG&gl=SG&ceid=SG:en", category: "Global Tech", region: "Singapore" },  // Google News regional edition
  { name: "GN: AI news (Brazil edition)", url: "https://news.google.com/rss/search?q=intelig%C3%AAncia%20artificial&hl=pt-BR&gl=BR&ceid=BR:pt-BR", category: "Global Tech", region: "Brazil" },  // Google News regional edition
  { name: "GN: AI news (South Korea edition)", url: "https://news.google.com/rss/search?q=%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5&hl=ko&gl=KR&ceid=KR:ko", category: "Global Tech", region: "South Korea" },  // Google News regional edition
  { name: "GN: AI news (Germany edition)", url: "https://news.google.com/rss/search?q=K%C3%BCnstliche%20Intelligenz&hl=de&gl=DE&ceid=DE:de", category: "Global Tech", region: "Germany" },  // Google News regional edition
  { name: "GN: AI news (France edition)", url: "https://news.google.com/rss/search?q=intelligence%20artificielle&hl=fr&gl=FR&ceid=FR:fr", category: "Global Tech", region: "France" },  // Google News regional edition
  { name: "GN: AI news (Mexico/LatAm edition)", url: "https://news.google.com/rss/search?q=inteligencia%20artificial&hl=es-419&gl=MX&ceid=MX:es", category: "Global Tech", region: "Mexico" },  // Google News regional edition
  { name: "GN: AI news (Taiwan edition)", url: "https://news.google.com/rss/search?q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD&hl=zh-TW&gl=TW&ceid=TW:zh-Hant", category: "Global Tech", region: "Taiwan" },  // Google News regional edition

];

module.exports = { SOURCES };

// ===== Non-tech title filter =====

// Hard rejects — brand rules that never pass, regardless of context
const HARD_REJECT = /wallpaper|giveaway|contest|save on your pass|discount code|cyber monday|black friday|newsletter|podcast episode|techcrunch disrupt|\bgta\b|grand theft|switch 2|xbox|playstation|nintendo|witcher|steam deck|epic games|fortnite|valorant|gaming|gamepad|controller review|8bitdo|directv|multiview|smart tv|apple tv|google tv|homepod|home speakers?|smart speaker|soundbar|home theat(?:er|re)|bluetooth speaker|wireless speaker|speaker (?:review|launch|deal)|sony.*(?:microphone|speaker)|repair cost|repairability comparison|the verge|bitcoin|ethereum|solana|\bxrp\b|dogecoin|\bcrypto\b|cryptocurrency|price drop|stock exchange|listed compan|market value|market cap|equity market|all-?share index|\bngx\b|\bjse\b|bullish|bearish|sell-?off|(?:bank|banking)[a-z ]{0,30}(?:app|application|service|relaunch|deposit|loan|ussd|branch|737)|interest rate|inflation|\bgdp\b|central bank|mortgage|money supply|entertainment (?:company|industry)|\bidol\b|record label|celebrity|\bactor\b|\bsinger\b|box office|talent (?:recruit|show)|\bbetting\b|gambl|football|soccer|premier league|\bnba\b|cricket|tournament|championship|ambassadorial|election|parliament|senate|minister|presidency|digital divide|internet access (?:to|for) (?:public|schools|libraries)/i;

// Market-price language — rejected ONLY when no tech anchor rescues the story
const PRICE_WORDS = /\b(?:falls?|fell|drops?|dropped|rise[sd]?|rose|surge[sd]?|plunge[sd]?|slump[sd]?|rall(?:y|ies|ied))\b/i;

// Music/entertainment vocabulary — rejected UNLESS a tech anchor is present
const MUSIC_WORDS = /\b(?:albums?|music|musicians?|synths?|synthesizers?|soundtracks?|concerts?|festivals?|remix(?:es)?|vinyl|dj)\b/i;

// Updated: added spotify + data center as anchors
const TECH_ANCHOR = /\b(?:ai|artificial intelligence|chatgpt|chatbot|llm|machine learning|chip|semiconductor|processor|gpu|smartphone|iphone|android|windows|ios|startup|funding|venture|cyber|hack|data breach|robot|drone|satellite|quantum|battery|5g|software|openai|anthropic|claude|gemini|copilot|deepseek|qwen|grok|mistral|google|apple|microsoft|nvidia|meta|amazon|tesla|tencent|alibaba|huawei|xiaomi|samsung|spacex|starlink|whatsapp|tiktok|instagram|telegram|snapchat|youtube|spotify|data cent(?:er|re))\b/i;

// One filter, two checkpoints: fetch time (raw title) + save time (rewritten headline)
function isOffBrand(text) {
  const t = (text || '').toLowerCase();
  if (!t) return false;
  if (HARD_REJECT.test(t)) return true;
  if ((MUSIC_WORDS.test(t) || PRICE_WORDS.test(t)) && !TECH_ANCHOR.test(t)) return true;
  return false;
}

// ---- 2. FETCH NEW ITEMS ----
async function fetchNewItems() {
  // Load ALL existing article URLs in ONE query
  const { data: existingRows } = await supabase
    .from('articles')
    .select('source_url');
  const existingUrls = new Set((existingRows ?? []).map((r) => r.source_url));

  // Load processed URLs: rejections are permanent, failures retry after 24 hours
  const { data: processedRows } = await supabase
    .from('processed_urls')
    .select('source_url, status, created_at');
  const processedUrls = new Set(
    (processedRows ?? [])
      .filter((r) => r.status === 'rejected' || new Date(r.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .map((r) => r.source_url)
  );

  const allItems = [];
  const seenThisRun = new Set();

  for (const source of SOURCES) {
    for (const page of [1, 2]) {
      try {
        const url =
          page === 1
            ? source.url
            : `${source.url}${source.url.includes('?') ? '&' : '?'}paged=${page}`;
        const feed = await parser.parseURL(url);
        const items = feed.items ?? [];

        for (const item of items) {
          if (!item.link || seenThisRun.has(item.link)) continue;
          if (existingUrls.has(item.link)) continue; // already saved
          if (processedUrls.has(item.link)) continue; // rejected, or failed recently

          // Skip old items — only ingest news from the last 10 days
          const itemDate = item.isoDate ? new Date(item.isoDate).getTime() : 0;
          if (itemDate && Date.now() - itemDate > 1 * 24 * 60 * 60 * 1000) continue;

          // ===== Non-tech title filter =====
          if (isOffBrand(item.title)) {
            console.log(`Filtered (non-tech): ${item.title}`);
            continue;
          }
          seenThisRun.add(item.link);
          allItems.push({ ...item, sourceName: source.name, category: source.category, region: source.region });
        }

        if (items.length < 10) break; // short feed — no page 2 exists
      } catch (err) {
        console.error(`Failed to fetch ${source.name} (page ${page}): ${err.message?.substring(0, 100)}`);
        break; // if page 1 fails, skip page 2
      }
    }
  }

  // Newest first across all sources
  allItems.sort((a, b) => new Date(b.isoDate ?? 0).getTime() - new Date(a.isoDate ?? 0).getTime());

  return allItems;
}
// ---- 3. REWRITE WITH AI ----
async function rewriteArticle(item) {
  // Truncate source content — keeps every provider under its token limits
  const rawContent = item.contentSnippet || item.content || '';
  const sourceContent = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);

  const prompt = `You are a neutral tech news writer for a general, non-technical global audience.

RELEVANCE CHECK — apply strictly before writing anything:
ACCEPT only tech-industry stories: new products, apps, AI models, chips, gadgets, cybersecurity,
tech company moves (launches, funding, layoffs, M&A), tech policy/regulation aimed at tech,
and computing/science research.
Decide if the story is GENUINELY tech news. It must be primarily about technology, AI, software, hardware, gadgets, internet, robotics, science, space, quantum computing, cyber security, startups, or the tech industry itself.
Reject ALL of these even if a tech company or tech person is mentioned:
- Business, finance, pension funds, stock markets, IPOs, oil, banking (unless it is fintech or crypto technology)
- Politics, government policy, legal disputes, court cases (unless the case is specifically about tech regulation or tech companies)
- Labor disputes, strikes, HR matters, executive suspension or leave
- Sports, entertainment, celebrity news, lifestyle
- Deals/discounts/sales on products (price drops, coupon codes, shopping events like Prime Day, "all-time low price")
- Events, conferences, ticket sales, promotional content
- Gaming content: video game releases, game, classic games, game release dates/rumors, game console/PC gaming coverage, gaming controller and accessory reviews (e.g., "coming to PC", Switch/PlayStation/Xbox game news, gaming peripheral reviews)
- Audio accessory minutiae: earbud/headphone firmware updates, minor accessory refreshes
- Phone Accessories: USB Cord, Speakers, Home Speakers, Home theater- Audio hardware: speakers, soundbars, home theater, microphones, headphones beyond major flagship launches
- TV and streaming platform features (smart tv, apple tv, multiview, channel guides, streaming apps on TVs)
- Company PR statements about ongoing business relationships (e.g., "CEO says contracts continue")
- Repair cost comparisons between devices
- Stock exchange listings, market caps, share price moves, sell-offs
- Crypto and asset price action (e.g. "Bitcoin drops below $62,000")
- Banking and consumer-finance services (e.g. a bank relaunching its mobile/USSD app)
- Entertainment, music, film, celebrity, sports, betting stories
- Startup business drama with no tech angle (a closure, founder dispute, failed roadmap, PR crisis)
- Digital-inclusion social programs (public Wi-Fi, library internet, digital-divide campaigns)
- Politics, elections, macroeconomics (inflation, interest rates) with no tech subject
- If no category fits naturally, REJECT — never force a story into a category.
- Individual HR matters (one executive suspended, one person fired, internal disputes)
- Court cases are tech news ONLY when they directly concern a tech company's products, data practices, or AI technology (e.g., states suing OpenAI over children's data = keep as AI News; a parking dispute involving a tech CEO = reject)
- Product price announcements and discount posts (including "now available to preorder at $X" when the story is about the price, not the product)
If the tech angle is not the CENTRAL subject of the story, respond ONLY with:
Rule of thumb: if the story would still make sense in a world without the tech industry, reject it.
{"reject": true, "reason": "one short sentence"}

If the story passes the relevance check, rewrite it into:
1. A clear headline (under 12 words)
2. A 2-3 sentence summary that captures the key points
3. A 500-1000 word article body, fully in your own words but accurate and verifiable. Do not copy phrases from the original.
4. A "reliability" tag: "verified" if from independent testing/reporting, or "claimed" if it's a company announcement
5. Three to ten short glossary terms (technical word + one-sentence plain-language explanation)
6. A "category" — exactly one of: "AI News", "Mobile & Social", "Tech News", "Tech Giants", "Startups & Funding", "Research", "Deals", "Global Tech"
7. A "region" — where the story is about, in one or two words (examples: "Nigeria", "South Africa", "Singapore", "Japan", "Israel", "China", "US", "Europe", "Global"). Judge from the story content, not the source.
8. Three stock-photo search queries (2-4 words each) to illustrate this story. Rules: describe things you can SEE — objects, machines, places, people (e.g. "data center aisle", "robot arm factory", "circuit board macro"). NEVER use company or brand names — describe the product or industry instead (e.g. for a Nvidia chip story use "computer chip closeup"). Never abstract words alone like "future" or "innovation".

CATEGORY RULES:
- "AI News" — artificial intelligence: models, AI companies, AI research, AI applications, AI policy
- "Mobile & Social" — smartphones, phone hardware, phone reviews, apps, app stores, social media platforms and their features
- "Tech Giants" — tech industry LEADERS as people: their statements, essays, predictions, career moves, controversies. ONLY when the story is ABOUT the person. If a CEO simply commented on policy, that is not Tech Giants — reject it unless the statement is about technology itself
- "Tech News" — general technology: laptops, gadgets, robotics, hardware, cyber security, space tech, tech company product launches
- "Startups & Funding" — startup launches, funding rounds, venture capital, accelerators, startup ecosystem
- "Research" — scientific research, AI research papers, quantum computing research, biotech, lab breakthroughs
- "Deals" — mergers, acquisitions, major corporate partnerships between tech companies
- "Global Tech" — stories primarily about one country's or region's tech scene, ecosystem, or tech policy. The country's tech scene must be the subject — not general news that merely happened in that country
When unsure between two categories, choose the one a reader would most expect the story to appear under on a tech news site.
- Gadget accessory reviews (cables, chargers, controllers, earbuds) are NOT tech news — reject them unless the accessory represents a genuinely new technology.
- A story about a company raising money (funding rounds, IPOs, valuations) is "Startups & Funding". A story about a product's price dropping or a sale event is NOT news — reject it.

IMPORTANT RULES:
- Do not begin a Summary with "This article".
- Do not invent quotes, sources, statistics, or links.
- Do not fabricate any information not present in the source text.
- If you don't know something, leave it out rather than guessing.
- Format the body in simple markdown only: use "## Subheading" for section headings, "- item" for bullet lists, and **bold** for emphasis. Never use tables, code blocks, or # symbols for anything else.
- Do not add disclaimers, notes about verification, or meta-commentary about the source. Just report what the source says.

Respond ONLY in this exact JSON format, nothing else:
{"headline": "...", "summary": "...", "body": "...", "reliability": "...", "category": "...", "region": "...", "glossary": [{"term":"...","definition":"..."}], "imageQueries": ["...", "...", "..."]}

Source title: ${item.title}
Source site: ${item.sourceName} (suggested category: "${item.category}", suggested region: "${item.region}" — override these if the story content says otherwise)
Source content: ${sourceContent}`;

    // ================================================================
  // PROVIDER CHAIN — rebuilt to end the empty-article bug for good.
  //
  // GLM remains the workhorse (ladder + naps untouched). What changed:
  //   1. Every provider's answer is VALIDATED before it is returned.
  //   2. null / junk from a provider means "next provider", never
  //      "empty article" — the old code returned callGLM's null
  //      straight back, which is where every "raw: {}" came from.
  //   3. If nothing usable comes back, rewriteArticle THROWS — the
  //      article stays pending and is retried next run. An empty
  //      dump is now impossible by construction.
  //   4. Fallbacks are rationed (MAX_FALLBACK_ARTICLES per run) so
  //      the small free tiers still have quota late in the day.
  //      GLM writes the bulk; fallbacks are an emergency reserve.
  // ================================================================

  const validResult = (r) =>
    r && typeof r === 'object' && (
      r.reject === true ||                                          // a rejection verdict IS a valid result
      ((typeof r.title === 'string' && r.title.trim()) ||            // normalizeArticleFields shape
       (typeof r.headline === 'string' && r.headline.trim())) &&     // raw model shape
      typeof r.body === 'string' && r.body.trim().length > 0
    );

  const accept = (raw, name) => {
    let r = raw;
    if (typeof r === 'string') {                                    // Bazaar/Cloudflare/Groq20B/NVIDIA return JSON strings
      try { r = JSON.parse(r); } catch { r = null; }
    }
    if (validResult(r)) {
      if (!r._provider) r._provider = name;
      return r;
    }
    if (r) console.log(`[chain] ${name} returned unusable output — skipping to next provider`);
    return null;
  };

  // ---- 1. GLM — primary writer ----
  // A short nap (the 429 third strike, 1.5m) means GLM rejoins this
  // same run — wait it out instead of spending fallback quota.
  // Max 2 such waits per run so a congestion storm can't stall it.
  const glmNapLeft = glmDownUntil - Date.now();
  if (glmNapLeft > 0 && glmNapLeft <= 2 * 60 * 1000 && glmShortWaitsThisRun < 2) {
    glmShortWaitsThisRun++;
    console.log(`[glm] short nap — waiting ${Math.round(glmNapLeft / 1000)}s for GLM to rejoin this run`);
    await new Promise((r) => setTimeout(r, glmNapLeft + 1000));
  }

  if (Date.now() >= glmDownUntil) {
    const r = accept(await callGLM(prompt), 'glm');                 // callGLM never throws — it returns an article or null
    if (r) return r;                                                // null → GLM had nothing this time, fall through
  }

  // ---- 2. Fallback budget — this is what protects the free tiers ----
  if (fallbackArticlesThisRun >= MAX_FALLBACK_ARTICLES) {
    if (!providerDown.__budgetNotice) {
      providerDown.__budgetNotice = true;
      console.log(`[chain] fallback budget (${MAX_FALLBACK_ARTICLES}/run) already spent — remaining articles stay pending; GLM picks them up next run`);
    }
    throw new Error('GLM unavailable, fallback budget spent — staying pending');
  }
  fallbackArticlesThisRun++;

  // ---- 3. Free-tier fallbacks (each benches itself for the run on throttle) ----
  const freeFallbacks = [
    // [log name, down-flag, env ready, call]
    ['groq',       'groq',       !!process.env.GROQ_API_KEY,       () => callGroq(prompt)],
    ['bazaar',     'Bazaar',     !!process.env.BAZAARLINK_API_KEY, () => callBazaar(prompt)],
    ['cloudflare', 'Cloudflare', !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CF_ACCOUNT_ID), () => callCloudflare(prompt)],
    ['groq20b',    'Groq20B',    !!process.env.GROQ_API_KEY,       () => callGroq20B(prompt)],
    ['nvidia',     'NVIDIA',     !!process.env.NVIDIA_API_KEY,     () => callNvidia(prompt)],
    ['nvidia2',    'NVIDIA2',    !!process.env.NVIDIA_API_KEY,     () => callNvidia2(prompt)],
  ];
  for (const [name, flag, envOk, call] of freeFallbacks) {
    if (!envOk || providerDown[flag]) continue;
    try {
      const r = accept(await call(), name);
      if (r) return r;
    } catch (err) {
      const msg = String(err?.message || err);
      if (/already failed this run/.test(msg)) continue;            // provider benched itself — gate skips it next article
      if (name === 'groq' && /429|rate|unavailable for free|403/i.test(msg)) {
        providerDown.groq = true;                                   // groq is the only one that can't bench itself
        console.warn('Groq throttled — skipping rest of this run');
        continue;
      }
      console.warn(`${name} failed, falling back: ${msg.slice(0, 160)}`);
    }
  }

  // ---- 4. Last-resort tier — smallest daily quotas, tried last ----
  for (const [name, call] of [
    ['openrouter', () => callOpenRouter(prompt)],
    ['axforge',    () => callAxforge(prompt)],
    ['kilo',       () => callKilo(prompt)],
  ]) {
    try {
      const r = accept(await call(), name);
      if (r) return r;
    } catch (err) {
      console.warn(`${name} failed, falling back: ${String(err?.message || err).slice(0, 160)}`);
    }
  }

  // ---- 5. Nothing usable from anyone — throw so the article stays pending ----
  throw new Error('no provider produced a usable article this run — staying pending');
}

// ---- run-scoped chain state (fresh process = fresh workflow run) ----
let fallbackArticlesThisRun = 0;   // articles handed to non-GLM providers this run
const MAX_FALLBACK_ARTICLES = 3;   // the one dial: raise = more fallback writing, lower = protect quotas harder
let glmShortWaitsThisRun = 0;      // short-nap waits used this run (max 2)

async function retryFetch(url, options) {
  let res = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 2500));
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) });
  }
  return res;
}

function safeParseJSON(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;      // no JSON object in the reply at all
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (Object.keys(parsed).length === 0) return null;  // bare {} is junk, not a success
    return parsed;
  } catch {
    return null;
  }
}

let glmDownUntil = 0;

async function callGLM(prompt) {
  if (Date.now() < glmDownUntil) return null;

  if (!process.env.GLM_API_KEY) {
    console.log('[glm] GLM_API_KEY not set — skipping');
    glmDownUntil = Date.now() + 6 * 60 * 60 * 1000;
    return null;
  }

  const waits = [6000, 18000]; // before retry 2 and 3

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'glm-4.7-flash',
          thinking: { type: 'disabled' },
          messages: [
            { role: 'system', content: 'You are a professional news writer and editor. Respond with valid JSON only, no extra text.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (res.status === 429 && attempt <= 2) {
        console.log(`[glm] congestion (429) — retry ${attempt + 1}/3 in ${waits[attempt - 1] / 1000}s`);
        await new Promise((r) => setTimeout(r, waits[attempt - 1]));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const snippet = body.slice(0, 120).replace(/\s+/g, ' ');
        let minutes;
        if (res.status === 402) minutes = 60;
        else if ([401, 403, 404].includes(res.status)) minutes = 360;
        else if (res.status === 429) minutes = 1.5;  // 3rd strike — short nap, rejoins this same run
        else minutes = 15;
        glmDownUntil = Date.now() + minutes * 60 * 1000;
        console.log(`[glm] down for ${minutes}m — HTTP ${res.status} ${snippet}`);
        return null;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        glmDownUntil = Date.now() + 15 * 60 * 1000;
        console.log('[glm] down for 15m — empty response');
        return null;
      }

      const article = normalizeArticleFields(repairArticleJSON(text));
      if (!article) {
        console.log('[glm] returned non-JSON reply, skipping to next provider');
        return null;
      }

      article._provider = 'glm';
      console.log('[glm] ok');
      return article;

    } catch (err) {
      const msg = String(err?.message || err);
      // The model wrote garbage JSON — GLM itself is healthy, so NO nap:
      // fall through and let the next provider try (GLM gets the next article).
      if (/No JSON object|Unparseable article JSON|JSON has no|body too short/i.test(msg)) {
        console.log('[glm] returned non-JSON reply, skipping to next provider');
        return null;
      }
      const cause = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code || msg || 'network error');
      glmDownUntil = Date.now() + 15 * 60 * 1000;
      console.log(`[glm] down for 15m — ${cause}`);
      return null;
    }
  }

  return null;
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await retryFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq error: ${res.status} — ${errBody.substring(0, 200)}`);
  }
  const data = await res.json();
  return safeParseJSON(data.choices[0].message.content);
}

async function callBazaar(prompt) {
  if (providerDown.Bazaar) throw new Error('BazaarLink already failed this run');
  try {
    const res = await retryFetch('https://api.bazaarlink.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BAZAARLINK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-flash-0731free',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000
      })
    });
    const data = await res.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error('BazaarLink: ' + JSON.stringify(data).slice(0, 200));
    }
    let content = (data.choices[0].message.content || '').trim();
    console.log(`BazaarLink responded (${content.length} chars)`);
    console.log(`BazaarLink raw: ${content.slice(0, 120).replace(/\s+/g, ' ')}`);
    content = content.replace(/[\s\S]*?<\/think>/gi, '');
    if (content.includes('<|message|>')) content = content.slice(content.lastIndexOf('<|message|>') + 11);
    content = content.replace(/<\|start\|>|<\|end\|>|<\|channel\|>\s*final/g, '').trim();
    const obj = normalizeArticleFields(repairArticleJSON(content));
    console.log('BazaarLink JSON OK');
    return JSON.stringify(obj);
  } catch (err) {
    
    if (/429|rate|quota|unit|limit|concurrent|insufficient|balance|timeout|abort|401|402|403/i.test(err.message)) {
      providerDown.Bazaar = true;
      console.log('BazaarLink throttled — skipping rest of this run');
    }
    throw err;
  }
}

// ===== NEW PROVIDER MODELS (Nov 2026 refresh) =====
const OPENROUTER_MODEL = "nvidia/nemotron-3.5-lightning:free";        // OpenRouter - 1M ctx, 50 req/day
const AXFORGE_MODEL    = "glm-5.3-flash";                             // AxForge (EU) - 3M tokens/30 days
const KILO_MODEL       = "nvidia/nemotron-3.5-lightning:free";        // Kilo free pool - no key needed

// ================================================================
// Circuit breaker — shared by every provider that uses callOpenAIStyle.

function isProviderDown(label) {
  const until = providerDown[label];
  if (!until) return false;
  if (Date.now() >= until) { delete providerDown[label]; return false; }
  return true;
}

function markProviderDown(label, ms, cause) {
  providerDown[label] = Date.now() + ms;
  console.log(`[${label}] down for ${Math.round(ms / 60000)}m — ${cause}`);
}

// ================================================================
// Shared OpenAI-compatible caller — full circuit breaker built in.
// ================================================================
async function callOpenAIStyle(label, url, apiKey, model, prompt, timeoutMs) {
  if (isProviderDown(label)) return null; // sleeping: skip instantly, no request wasted

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a professional news editor. Respond with valid JSON only, no extra text." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const snippet = body.slice(0, 120).replace(/\s+/g, " ");
      if (res.status === 402) {
        markProviderDown(label, 60 * 60 * 1000, `HTTP 402 ${snippet}`);              // credit / check-in needed
      } else if ([401, 403, 404].includes(res.status)) {
        markProviderDown(label, 6 * 60 * 60 * 1000, `HTTP ${res.status} ${snippet}`); // bad key or dead model
      } else {
        markProviderDown(label, 15 * 60 * 1000, `HTTP ${res.status} ${snippet}`);     // 429 / 5xx / anything else
      }
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      markProviderDown(label, 15 * 60 * 1000, "empty response");
      return null;
    }

    const article = normalizeArticleFields(repairArticleJSON(text));
    if (!article) {
      // garbage JSON = model problem, not provider problem:
      // no cooldown, just fall through to the next provider
      console.log(`[${label}] returned non-JSON reply, skipping to next provider`);
      return null;
    }

    console.log(`[${label}] ok`);
    return article;
  } catch (err) {
    const cause = err?.name === "TimeoutError"
      ? "timeout"
      : (err?.cause?.code || err?.message || "network error");
    markProviderDown(label, 15 * 60 * 1000, cause);
    return null;
  }
}
// ---------- OpenRouter: free models, 20 RPM / 50 requests per day ----------
function callOpenRouter(prompt) {
  return callOpenAIStyle(
    "openrouter",
    "https://openrouter.ai/api/v1/chat/completions",
    process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    prompt,
    60000
  );
}

// ---------- AxForge: EU-hosted open models, 3M tokens every 30 days ----------
function callAxforge(prompt) {
  return callOpenAIStyle(
    "axforge",
    "https://api.axforge.ai/v1/chat/completions",
    process.env.AXFORGE_API_KEY,
    AXFORGE_MODEL,
    prompt,
    60000
  );
}

// ---------- Kilo Code: free pool, 200 req/hr, no key required (experimental tail) ----------
function callKilo(prompt) {
  return callOpenAIStyle(
    "kilo",
    "https://api.kilo.ai/api/gateway/chat/completions",
    // if [kilo] returns 404 in the logs, try https://api.kilo.ai/api/gateway/v1/chat/completions
    process.env.KILO_API_KEY || "free",
    KILO_MODEL,
    prompt,
    45000
  );
}

// ---------- JSON repair for small models ----------
function looseGrab(text, names) {
  const un = s => s.replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  for (const n of names) {
    let m = text.match(new RegExp('"' + n + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
    if (!m || !m[1].trim()) m = text.match(new RegExp('"' + n + '"\\s*:\\s*"([\\s\\S]*?)"\\s*,\\s*"'));
    if (!m || !m[1].trim()) m = text.match(new RegExp('"' + n + '"\\s*:\\s*"([\\s\\S]*?)"\\s*[}\\]]'));
    if (m && m[1].trim()) return un(m[1]);
  }
  return undefined;
}

function repairArticleJSON(raw) {
  let t = raw;
  const fence = t.indexOf('```');
  if (fence !== -1) {
    const after = t.slice(fence + 3);
    const end = after.indexOf('```');
    t = end === -1 ? after : after.slice(0, end);
  }
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('No JSON object in response');
  const candidate = t.slice(first, last + 1);
  try { return JSON.parse(candidate); } catch {}
  try { return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')); } catch {}
  try {
    return JSON.parse(candidate
      .replace(/[“”]/g, '"')
      .replace(/,\s*([}\]])/g, '$1'));
  } catch {}
  try {
    return JSON.parse(candidate
      .replace(/[“”]/g, '"')
      .replace(/\r?\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/,\s*([}\]])/g, '$1'));
  } catch {}
  const lgHeadline = looseGrab(candidate, ['headline', 'title', 'head']);
  const lgBody = looseGrab(candidate, ['body', 'article', 'content', 'text']);
  if (lgHeadline && lgBody) {
    console.log('JSON repaired by loose field extraction');
    return { headline: lgHeadline, body: lgBody, summary: looseGrab(candidate, ['summary', 'excerpt', 'description']) || '' };
  }
  throw new Error('Unparseable article JSON (starts: ' + candidate.slice(0, 120) + ')');
}

function normalizeArticleFields(obj) {
  // unwrap nested shapes some models produce: {"article": {...}} / {"data": {...}}
  for (const key of ['article', 'data', 'result', 'output']) {
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      for (const [k, v] of Object.entries(obj[key])) if (!(k in obj)) obj[k] = v;
    }
  }
  // normalize rejection spellings so the pipeline's rejection counter sees them
  if (obj.rejected || obj.skip || obj.not_tech || obj.irrelevant) obj.reject = true;
  if (obj.reject) return obj;
  let body = obj.body || obj.article || obj.content || obj.text || obj.article_body || obj.articleBody;
  if (Array.isArray(body)) body = body.filter(p => typeof p === 'string' && p.trim()).join('\n\n');
  const title = obj.title || obj.headline;
  if (!title || !String(title).trim()) throw new Error('JSON has no title (fields: ' + Object.keys(obj).join(',') + ')');
  if (!body || !String(body).trim()) throw new Error('JSON has no body (fields: ' + Object.keys(obj).join(',') + ')');
  if (String(body).trim().length < 200) throw new Error('body too short (' + String(body).trim().length + ' chars): "' + String(body).trim().slice(0, 100) + '"');
  const out = { ...obj };
  out.title = String(title).trim();
  out.body = String(body).trim();
  return out;
}

// ---------- NEW FREE PROVIDERS (Cloudflare + Cerebras, Oct 2026) ----------

// ---------- Cross-feed duplicate shield ----------

const DUP_DIFF_WORDS = new Set(['update','updates','delay','delays','delayed','recall','recalls','postpone','postpones','suspend','suspends','cancel','cancels','versus']);
const DUP_PROD_WORDS = new Set(['pro','air','max','mini','plus','ultra','lite','fold','flip','duo']);
const DUP_STOP_WORDS = new Set(['the','and','for','with','from','this','that','have','will','your','what','when','into','than','then','they','them','been','more','most','some','just','also','like','make','made','take','about','after','says','said','over','amid','could','would','should','their','there','these','those','where','which','while','being','every','among','across','since','until','still','again','once','here','other']);

function dupTokens(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[''’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !DUP_STOP_WORDS.has(w));
}

function storyDuplicateScore(a, b) {
  const ta = dupTokens(a), tb = dupTokens(b);
  if (ta.length < 2 || tb.length < 2) return 0;
  const sa = new Set(ta), sb = new Set(tb);
  let shared = 0;
  for (const w of sa) if (sb.has(w)) shared++;
  if (shared < 2) return 0;

  // follow-up protection: one is an update/delay story, the other is not
  const dA = ta.some(w => DUP_DIFF_WORDS.has(w));
  const dB = tb.some(w => DUP_DIFF_WORDS.has(w));
  if (dA !== dB) return 0;

  // product-variant protection: "MacBook Pro" vs "MacBook Air"
  const pa = ta.filter(w => DUP_PROD_WORDS.has(w)).sort().join(',');
  const pb = tb.filter(w => DUP_PROD_WORDS.has(w)).sort().join(',');
  if (pa && pb && pa !== pb) return 0;

  // different numbers = different stories ("iPhone 16" vs "iPhone 17")
  const na = (String(a).match(/\d+/g) || []).sort().join();
  const nb = (String(b).match(/\d+/g) || []).sort().join();
  if (na && nb && na !== nb) return 0;

  const jac = shared / (sa.size + sb.size - shared);

  // shared consecutive-phrase bonus ("robotic animals", "startup rune")
  let phrase = 0;
  for (let i = 0; i < ta.length - 1; i++) {
    const j = tb.indexOf(ta[i]);
    if (j !== -1 && tb[j + 1] === ta[i + 1]) phrase++;
  }

  // proper-noun bonus (same capitalized names in both)
  const capsA = String(a).match(/\b[A-Z][a-zA-Z]{3,}\b/g) || [];
  const capsB = new Set(String(b).match(/\b[A-Z][a-zA-Z]{3,}\b/g) || []);
  const propHits = capsA.filter(w => capsB.has(w)).length;

  return Math.min(1, jac + phrase * 0.12 + propHits * 0.11);
}

async function loadRecentArticleTitles() {
  // FIX: old version used `prisma`, which doesn't exist in this pipeline.
  // Now uses the same Supabase client the save path uses (auto-detected),
  // or the Supabase REST API as fallback.
  const db = (typeof supabase !== 'undefined' && supabase) ||
             (typeof supabaseAdmin !== 'undefined' && supabaseAdmin);
  if (db) {
    const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    for (const col of ['created_at', 'createdAt']) {
      const { data, error } = await db.from('articles').select('title').gte(col, since).limit(3000);
      if (!error) return (data || []).map(r => r.title);
    }
    const { data, error } = await db.from('articles').select('title').limit(3000);
    if (error) throw new Error('articles query failed: ' + (error.message || JSON.stringify(error).slice(0, 120)));
    return (data || []).map(r => r.title);
  }
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (base && key) {
    const res = await fetch(`${base}/rest/v1/articles?select=title&limit=3000`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (res.ok) return (await res.json()).map(r => r.title);
    throw new Error('Supabase REST ' + res.status);
  }
  throw new Error('no Supabase client found — check the variable name used where articles are saved');
}

async function isDuplicateStory(titles) {
  try {
    const recents = await loadRecentArticleTitles();
    let best = null;
    for (const recentTitle of recents) {
      for (const t of titles) {
        const s = storyDuplicateScore(t, recentTitle);
        if (s >= 0.5 && (!best || s > best.sim)) best = { match: recentTitle, sim: s };
      }
    }
    return best;
  } catch (e) {
    console.log('Dup shield error (ignored): ' + e.message);
    return null;
  }
}

async function callCloudflare(prompt) {
  if (providerDown.Cloudflare) throw new Error('Cloudflare already failed this run');
  try {
    const res = await retryFetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000
      })
    });
    const data = await res.json();
    if (!data.choices || !data.choices[0]) {
      const em = data.errors ? JSON.stringify(data.errors) : JSON.stringify(data);
      throw new Error('Cloudflare: ' + em.slice(0, 200));
    }
    let content = (data.choices[0].message.content || '').trim();
    console.log(`Cloudflare responded (${content.length} chars)`);
    console.log('Cloudflare raw: ' + content.slice(0, 220).replace(/\s+/g, ' '));
    content = content.replace(/[\s\S]*?<\/think>/gi, '');
    if (content.includes('<|message|>')) content = content.slice(content.lastIndexOf('<|message|>') + 11);
    content = content.replace(/<\|start\|>|<\|end\|>|<\|channel\|>\s*final/g, '').trim();
    const obj = normalizeArticleFields(repairArticleJSON(content));
    console.log('Cloudflare JSON OK');
    return JSON.stringify(obj);
  } catch (err) {
    if (/429|rate|quota|allocation|neurons|timeout|abort|401|403/i.test(err.message)) {
      providerDown.Cloudflare = true;
      console.log('Cloudflare throttled — skipping rest of this run');
    }
    throw err;
  }
}

async function callGeminiFirst(prompt) {
  // 1) Cloudflare Workers AI — free 10,000 neurons/day, no card
  if (!providerDown.Cloudflare && process.env.CLOUDFLARE_API_TOKEN && process.env.CF_ACCOUNT_ID) {
    try {
      return await callCloudflare(prompt);
    } catch (err) {
      if (/429|rate|quota|timeout|abort|degraded|401|402|403|404|410|insufficient|balance|credit|expired/i.test(err.message)) {
        providerDown.Cloudflare = true;
        console.log('Cloudflare throttled — skipping rest of this run');
      }
      console.log('Cloudflare failed, falling back: ' + err.message);
    }
  }
    // 3) Original Gemini, untouched
  return await callGemini(prompt);
}

async function callGroq20B(prompt) {
  if (providerDown.Groq20B) throw new Error('Groq20B already failed this run');
  try {
    const res = await retryFetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        reasoning_effort: 'low'
      })
    });
    const data = await res.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error('Groq20B: ' + JSON.stringify(data).slice(0, 200));
    }
    let content = (data.choices[0].message.content || '').trim();
    console.log(`Groq20B responded (${content.length} chars)`);
    console.log('Groq20B raw: ' + content.slice(0, 220).replace(/\s+/g, ' '));
    content = content.replace(/[\s\S]*?<\/think>/gi, '');
    if (content.includes('<|message|>')) content = content.slice(content.lastIndexOf('<|message|>') + 11);
    content = content.replace(/<\|start\|>|<\|end\|>|<\|channel\|>\s*final/g, '').trim();
    const obj = normalizeArticleFields(repairArticleJSON(content));
    console.log('Groq20B JSON OK');
    return JSON.stringify(obj);
  } catch (err) {
    if (/429|rate|quota|timeout|abort|401|403/i.test(err.message)) {
      providerDown.Groq20B = true;
      console.log('Groq20B throttled — skipping rest of this run');
    }
    throw err;
  }
}

async function callNvidia(prompt) {
  if (providerDown.NVIDIA) throw new Error('NVIDIA already failed this run');
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'z-ai/glm-5.3',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`NVIDIA ${res.status} — ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error('No choices in NVIDIA response');
    let content = (data.choices[0].message.content || '').trim();
    console.log(`NVIDIA responded (${content.length} chars)`);
    content = content.replace(/[\s\S]*?<\/think>/gi, '');
    const obj = normalizeArticleFields(repairArticleJSON(content));
    console.log('NVIDIA JSON OK');
    return JSON.stringify(obj);
  } catch (err) {
    providerDown.NVIDIA = true;
    console.log('NVIDIA throttled/hung — skipping rest of this run');
    throw err;
  }
}

async function callNvidia2(prompt) {
  if (providerDown.NVIDIA2) throw new Error('NVIDIA2 already failed this run');
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/deepseek-v4.1-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`NVIDIA2 ${res.status} — ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error('No choices in NVIDIA2 response');
    let content = (data.choices[0].message.content || '').trim();
    console.log(`NVIDIA2 responded (${content.length} chars)`);
    content = content.replace(/[\s\S]*?<\/think>/gi, '');
    const obj = normalizeArticleFields(repairArticleJSON(content));
    console.log('NVIDIA2 JSON OK');
    return JSON.stringify(obj);
  } catch (err) {
    providerDown.NVIDIA2 = true;
    console.log('NVIDIA2 throttled/hung — skipping rest of this run');
    throw err;
  }
}

// ---- 4. FETCH IMAGE FROM UNSPLASH ----
// ★ Completely rebuilt. Never uses the headline directly, never repeats an image,
// never falls back to source-article images (that was the Alamy watermark leak).

const CATEGORY_IMAGE_TERMS = {
  'AI News': ['neural network visualization', 'artificial intelligence abstract', 'robot technology'],
  'Tech Giants': ['server room', 'data center', 'modern tech office'],
  'Tech News': ['circuit board macro', 'computer chip closeup', 'gpu graphics card'],
  'Startups & Funding': ['startup team meeting', 'modern workspace', 'business handshake'],
  'Research': ['research laboratory', 'scientist at computer', 'data analysis screen'],
  'Deals': ['stock market screen', 'finance charts', 'business deal'],
  'Global & China': ['asia city skyline night', 'global network map', 'shanghai skyline'],
  'Latest': ['abstract technology blue', 'futuristic screen', 'circuit board'],
};

function imageKey(url) {
  const m = (url || '').match(/photo-([\w-]+)/);
  return m ? m[1] : url;
}

// ---- Source image extraction: use the publisher's own photo when it's clean ----
const BANNED_IMAGE_HOSTS = /(alamy|shutterstock|gettyimages|istockphoto|dreamstime|123rf|depositphotos|stock\.adobe)/i;

function extractSourceImage(item) {
  const candidates = [];

  // 1. media:content — where TechCrunch/WIRED/Verge put their hero image
  const mc = item['media:content'];
  if (mc) {
    for (const m of (Array.isArray(mc) ? mc : [mc])) {
      if (m?.url && (!m.type || m.type.startsWith('image/'))) {
        candidates.push({ url: m.url, width: parseInt(m.width || 0, 10) });
      }
    }
  }

  // 2. media:thumbnail
  if (item['media:thumbnail']?.url) {
    candidates.push({ url: item['media:thumbnail'].url, width: parseInt(item['media:thumbnail'].width || 0, 10) });
  }

  // 3. enclosure
  if (item.enclosure?.url && (item.enclosure.type || '').startsWith('image/')) {
    candidates.push({ url: item.enclosure.url, width: 0 });
  }

  // 4. first <img> in the content HTML
  const imgMatch = (item.content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) candidates.push({ url: imgMatch[1], width: 0 });

  // Validate: biggest first; reject stock hosts, non-images, tiny, logos
  for (const c of candidates.sort((a, b) => b.width - a.width)) {
    const u = c.url || '';
    if (!/^https?:\/\//.test(u)) continue;
    if (BANNED_IMAGE_HOSTS.test(u)) continue;
    if (/\.(svg|gif)(\?|$)/i.test(u)) continue;
    if (c.width && c.width < 400) continue;
    if (/logo|icon|avatar|tracking|analytics|1x1|spacer/i.test(u)) continue;
    return c.url;
  }
  return null;
}

// Seed dedup with the last 300 images used in articles
async function loadUsedImageKeys() {
  const { data } = await supabase
    .from('articles')
    .select('image_url')
    .order('created_at', { ascending: false })
    .limit(300);
  return new Set((data ?? []).map((r) => imageKey(r.image_url)).filter(Boolean));
}

async function searchUnsplash(query, usedKeys) {
  const url =
    'https://api.unsplash.com/search/photos?query=' +
    encodeURIComponent(query) +
    '&per_page=30&orientation=landscape&content_filter=high';
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  });
  if (!res.ok) return [];
  const { results = [] } = await res.json();
  return results
    .filter((r) => !r.premium)
    .filter((r) => r.width >= 1600 && r.height >= 900)
    .filter((r) => !usedKeys.has(imageKey(r.urls.raw)))
    .map((r) => ({
      url: `${r.urls.raw}&w=1600&q=80&fm=jpg`,
      key: imageKey(r.urls.raw),
      creditName: r.user?.name ?? 'Unsplash photographer',
      creditUrl: r.user?.links?.html ?? 'https://unsplash.com',
    }));
}

// ---- Fuzzy duplicate detection: same story → same meaningful-word signature ----
const STOP_WORDS = new Set(['the','a','an','of','for','and','or','to','in','on','with','new','its','is','are','as','at','by','from','this','that','unveils','rolls','out','launches','announces','reveals','partners','gets','says','will']);

function fingerprint(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)].sort();
}

// Words that signal a DIFFERENT story about the same product — never a duplicate
const DIFFERENTIATORS = /\b(update|updates|delay|delays|cancel|cancelled|recall|patch|fix|fixes|review|rumor|rumour|versus|discount|lawsuit|sues|probe)\b/i;

function isLikelyDuplicate(titleA, titleB) {
  if (DIFFERENTIATORS.test(titleA) || DIFFERENTIATORS.test(titleB)) return false;

  // Extract proper-noun phrases (capitalized word pairs like "Fitbit Air", "Z Fold")
  const properNouns = (t) => {
    const matches = (t.match(/\b[A-Z][a-z0-9]+(?:\s+[A-Z0-9][a-z0-9]+)*/g) ?? []);
    return [...new Set(matches.filter((p) => p.length > 3))];
  };
  const pnA = properNouns(titleA);
  const pnB = properNouns(titleB);

  // Two matching proper-noun phrases ≥ 10 chars total = same subject ("Fitbit Air" + "Apple Watch")
  if (pnA.length >= 1 && pnB.length >= 1) {
    const shared = pnA.filter((p) => pnB.some((q) => q.toLowerCase() === q && p.toLowerCase() === q.toLowerCase() && p.length >= 4));
    // require the shared phrase to be meaningful (≥ 8 chars, e.g. "Fitbit Air" = 10)
    const meaningfulShared = shared.filter((p) => p.replace(/\s/g, '').length >= 8);
    if (meaningfulShared.length >= 1) return true;
  }

  // Original word-overlap check (still active for titles without clear proper nouns)
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const a = [...new Set(words(titleA))].sort();
  const b = [...new Set(words(titleB))].sort();
  if (!a.length || !b.length) return false;
  if (a.length < 3 || b.length < 3) return a.join(' ') === b.join(' ');
  const sharedWords = a.filter((w) => b.includes(w)).length;
  return sharedWords / Math.max(a.length, b.length) >= 0.6;
}

async function fetchImage(rewritten, category, usedKeys) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;

  const aiQueries = (rewritten.imageQueries ?? [])
    .map((q) => String(q).trim().toLowerCase())
    .filter((q) => q.length > 2 && q.length < 40);

  const fallbacks = CATEGORY_IMAGE_TERMS[category] ?? CATEGORY_IMAGE_TERMS['Latest'];

  for (const query of [...aiQueries, ...fallbacks]) {
    const candidates = await searchUnsplash(query, usedKeys);
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * Math.min(12, candidates.length))];
      usedKeys.add(pick.key);
      return { url: pick.url, creditName: pick.creditName, creditUrl: pick.creditUrl };
    }
  }
  return null;
}

async function saveArticle(item, rewritten, usedKeys) {
  // Guard: skip empty/broken rewrites
    // ---- Universal guard + duplicate gate (v2) ----
  let r = rewritten || {};
  if (typeof r === 'string') {
    try {
      r = normalizeArticleFields(repairArticleJSON(r));
      console.log('Guard rescued a raw JSON string');
    } catch (e) { r = {}; }
  }

  if (r.reject || r.rejected || r.skip) {
    console.log('Rejected by AI:', item.title ?? item.link, '—', String(r.reason || '').slice(0, 90));
    return false;
  }

  const headline = String(r.headline || r.title || r.head || '').trim();
  const body = String(r.body || r.article || r.content || r.text || '').trim();
  let summary = String(r.summary || r.excerpt || r.description || r.subtitle || '').trim();
  if (!summary && body) summary = body.replace(/\s+/g, ' ').slice(0, 280);

  rewritten = { ...r, headline, title: headline, body, article: body, summary };

  // ---- empty guard: nothing publishable = transient failure, stays pending ----
  if (!rewritten.headline || !rewritten.body) {
    console.log(`Skipping empty article: ${item.title} — headline or body missing`);
    console.log('[empty-dump] provider:', r?._provider ?? '(old provider, no stamp)',
                'raw:', JSON.stringify(r ?? null).slice(0, 200));
    return false;
  }


    // ---- off-brand check on the FINAL headline (catches junk the LLM rewrote) ----
  if (isOffBrand(headline)) {
    console.log(`Skipping off-brand rewrite: "${headline}" — from "${item.title}"`);
    await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
    return false;
  }
   // ---- duplicate gate AFTER the rewrite (catches paraphrases) ----
  // 0.75 hard floor: looser matches are different stories. Confirmed duplicates
  // are marked processed so they leave pending permanently.
  const dupHit = await isDuplicateStory([item.title, headline]);
  const confirmedDup = (dupHit && (dupHit.sim ?? 1) >= 0.75) ? dupHit : null;
  if (confirmedDup) {
    console.log(`Skipping duplicate story: "${headline}" ~ already saved as "${confirmedDup.match}" (sim ${confirmedDup.sim.toFixed(2)})`);
    await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
    return false;
  }

  // Category/region: trust the LLM's read of the story, fall back to the source's values
  const VALID_CATEGORIES = ['AI News', 'Mobile & Social', 'Tech News', 'Tech Giants', 'Startups & Funding', 'Research', 'Deals', 'Global Tech'];
  const category = VALID_CATEGORIES.includes(rewritten.category) ? rewritten.category : item.category;
  const region = (typeof rewritten.region === 'string' && rewritten.region.trim().length > 0) ? rewritten.region.trim() : item.region;

  // Fuzzy duplicate check against articles saved in the last 10 days
  const threeDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('articles')
    .select('id, title')
    .gte('created_at', threeDaysAgo);
  for (const recentItem of recent ?? []) {
    if (isLikelyDuplicate(rewritten.headline, recentItem.title)) {
      console.log(`Skipping duplicate: "${rewritten.headline}" ~ already saved as "${recentItem.title}"`);
      await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
      return false;
    }
  }

  // Same publisher + same image = re-served/reposted article — always a duplicate
  const sourceImg = extractSourceImage(item);
  if (sourceImg) {
    const { data: imgDup } = await supabase
      .from('articles')
      .select('id, title')
      .eq('source_name', item.sourceName)
      .eq('image_url', sourceImg)
      .limit(1);
    if (imgDup && imgDup.length > 0) {
      console.log(`Skipping repost (same image): "${rewritten.headline}" ~ already saved as "${imgDup[0].title}"`);
      await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
      return false;
    }
  }

  // Image: publisher's own photo first (exact subject match), Unsplash as fallback
  const sourceImageUrl = extractSourceImage(item);
  let image;
  if (sourceImageUrl) {
    image = { url: sourceImageUrl, creditName: item.sourceName, creditUrl: item.link };
  } else {
    image = await fetchImage(rewritten, category, usedKeys);
  }

  const { error } = await supabase.from('articles').insert({
    title: rewritten.headline,
    summary: rewritten.summary,
    body: rewritten.body,
    category: category,
    region: region,
    source_url: item.link,
    source_name: item.sourceName,
    reliability: rewritten.reliability === 'verified' ? 'verified' : 'claimed',
    glossary: Array.isArray(rewritten.glossary) ? rewritten.glossary : [],
    published: true,
    image_url: image?.url ?? null,
    image_credit_name: image?.creditName ?? null,
    image_credit_url: image?.creditUrl ?? null,
  });
  if (error) {
    console.error(`Failed to save article: ${error.message}`);
    return false;
  }
  console.log(`Saved: ${rewritten.headline} [${category} · ${region}]`);
  return true;
}
// ---- 6. MAIN ----
async function run() {
  console.log('Checking sources for new articles...');
  const newItems = await fetchNewItems();
  console.log(`Found ${newItems.length} new item(s).`);

  // ================================================================
  // ONE-TIME PENDING RESET — only runs when RESET_PENDING=1
  // Marks every currently-found feed item as processed, then exits.
  // ================================================================
  if (process.env.RESET_PENDING === '1') {
    console.log('==============================================');
    console.log('RESET_PENDING is ENABLED');

    if (!Array.isArray(newItems) || newItems.length === 0) {
      console.log('Nothing new found — pending is already 0.');
      process.exit(0);
    }

    const urls = [...new Set(newItems.map(i => i?.link).filter(Boolean))];
    console.log(`Marking ${urls.length} item(s) as processed...`);

    const { error: resetError } = await supabase
      .from('processed_urls')
      .insert(urls.map(u => ({ source_url: u, status: 'rejected' })));

    if (resetError) {
      console.log(`Insert failed: ${resetError.message}`);
      console.log('Nothing was saved — send me this error.');
      process.exit(1);
    }

    console.log(`Done. Pending is now 0 — the next run starts fresh.`);
    console.log('==============================================');
    process.exit(0);
  }

  const usedKeys = await loadUsedImageKeys();

  const MAX_PER_RUN = 10;
  const batch = newItems.slice(0, MAX_PER_RUN);
  if (newItems.length > MAX_PER_RUN) {
    console.log(`Processing ${MAX_PER_RUN} of ${newItems.length} — the rest will be picked up on the next run.`);
  }

  let saved = 0, rejected = 0, failed = 0;
  for (const item of batch) {
    try {
      // ---- duplicate gate BEFORE spending AI tokens (title-only) ----
      const preDup = await isDuplicateStory([item.title]);
      const confirmedPre = (preDup && (preDup.sim ?? 1) >= 0.75) ? preDup : null;
      if (confirmedPre) {
        console.log(`Skipping duplicate story (pre-check): "${item.title}" ~ already saved as "${confirmedPre.match}" (sim ${confirmedPre.sim.toFixed(2)})`);
        await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
        continue;
      }
      
      const rewritten = await rewriteArticle(item);

      if (rewritten?.reject) {
        console.log(`Rejected (not tech): ${item.title} — ${rewritten.reason ?? ''}`);
        await supabase.from('processed_urls').insert({ source_url: item.link, status: 'rejected' });
        rejected++;
        continue;
      }

      const ok = await saveArticle(item, rewritten, usedKeys);
      if (ok) saved++; else failed++;
    } catch (err) {
      console.error(`Skipping "${item.title}" — ${err.message}`);
      await supabase.from('processed_urls').insert({ source_url: item.link, status: 'failed' });
      failed++;

      // If every provider was down for this article, abort the batch —
      // remaining articles would fail identically and burn more quota
      if (providerDown.glm && providerDown.groq && providerDown.cloudflare && providerDown.groq20b && providerDown.nvidia && providerDown.nvidia2) {
        console.log('All providers exhausted — ending this run early. Providers recover before the next run.');
        break;
      }
    }
    await new Promise(r => setTimeout(r, 5000)); // 5s gap — gentler on free-tier rate limits
  }

  console.log(`Run complete. Saved: ${saved}, Rejected: ${rejected}, Failed: ${failed}`);
}

run();
