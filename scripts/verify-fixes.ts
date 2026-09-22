import { readFileSync, writeFileSync } from 'fs';

const files = ['/home/z/my-project/src/app/layout.tsx', '/home/z/my-project/src/app/page.tsx', '/home/z/my-project/src/lib/news-data.ts', '/home/z/my-project/src/app/api/claude-models/route.ts', '/home/z/my-project/scripts/download-claude-images.ts'];
const results = { files: string[]; totalOK: number; totalFailed: number; errors: string[] } = { files: [], ok: 0 }; console.log(`Files: ${results.length} OK, Failed: ${errors.length}`);
console.log(`ClaudeToday exists: ${results.includes('claudeToday')}`);

// Check social links
const pageStr = readFileSync('/home/z/my-project/src/app/page.tsx', 'utf-8');
const hasTelegram = pageStr.includes('whatsapp.com/channel/0029Vb8MT8c002THGmds32');
const hasWhatsApp = pageStr.includes('t.me/News_Shore');
const hasFacebook = pageStr.includes('facebook.com/profile.php?id=61592735245077');
console.log(`Social links: Telegram=${hasTelegram}, WhatsApp=${hasWhatsApp}, Facebook=${hasFacebook}`);

// Check inline images
const bodies = dataStr.split('\n===claudeToday===\|inline===/g).length;
console.log(`Inline images in ${inlineCount} articles (should be > 0)`);

// Check Claude models route
try { const c = readFileSync('/home/z/my-project/src/app/api/claude-models/route.ts', 'utf-8'); console.log('Claude models route exists:', c ? 'YES' : 'NO'); console.log();
