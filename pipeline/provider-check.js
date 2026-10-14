// Provider Health Check — tiny prompts, raw errors, no pipeline code involved
async function check(name, url, headers, body) {
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ ${name}: HTTP ${res.status} — working`);
    } else {
      const errText = await res.text();
      console.log(`❌ ${name}: HTTP ${res.status} — ${errText.substring(0, 250)}`);
    }
  } catch (err) {
    console.log(`❌ ${name}: network error — ${err.message}`);
  }
}

await check('GLM',
  'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GLM_API_KEY}` },
  { model: 'glm-4.7-flash', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] });

await check('Groq',
  'https://api.groq.com/openai/v1/chat/completions',
  { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  { model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] });

await check('Mistral',
  'https://api.mistral.ai/v1/chat/completions',
  { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
  { model: 'mistral-small-latest', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] });

await check('OpenRouter',
  'https://openrouter.ai/api/v1/chat/completions',
  { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  { model: 'qwen/qwen3-235b-a22b:free', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] });

await check('Gemini',
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
  { 'Content-Type': 'application/json' },
  { contents: [{ parts: [{ text: 'Reply with exactly: OK' }] }] });

await check('DeepSeek',
  'https://api.deepseek.com/chat/completions',
  { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
  { model: 'deepseek-chat', messages: [{ role: 'user', content: 'Reply with exactly: OK' }] });
