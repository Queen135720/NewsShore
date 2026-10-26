# post.py — routes each article to ONE platform, posts with image
import json, os, re, sys
from datetime import datetime, timezone
import requests
from supabase import create_client

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
TG_TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
TG_CHANNEL = os.environ["TELEGRAM_CHANNEL"]
OWNER_ID   = os.environ["OWNER_CHAT_ID"]
FB_PAGE, FB_TOKEN = os.environ["FACEBOOK_PAGE_ID"], os.environ["FACEBOOK_PAGE_TOKEN"]
FB_VER, SITE = "v22.0", os.environ["SITE_URL"]          # bump FB_VER when Meta deprecates

DAILY_CAPS   = {"whatsapp": 2, "facebook": 4, "telegram": 6}
MAX_ATTEMPTS = 3
CHUNK        = 15

# provider chain — all OpenAI-compatible, first with a key wins
LLMS = [
    ("https://api.z.ai/api/paas/v4",                           "ZAI_API_KEY",    os.environ.get("LLM_MODEL", "glm-4.5-flash")),
    ("https://api.groq.com/openai/v1",                         "GROQ_API_KEY",   "llama-3.3-70b-versatile"),
    ("https://generativelanguage.googleapis.com/v1beta/openai","GEMINI_API_KEY", "gemini-2.5-flash"),
]

def llm(prompt):
    err = None
    for base, key_env, model in LLMS:
        key = os.environ.get(key_env)
        if not key:
            continue
        try:
            r = requests.post(f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": model, "temperature": 0.3,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=120)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[llm] {key_env} failed: {e}")
            err = e
    raise RuntimeError(f"no LLM provider available: {err}")

EDITOR_PROMPT = """You are the social media editor for NewsShore, an AI & tech news site.
We publish 20-40+ articles per day. You receive a batch of new articles; for EACH one,
choose exactly one distribution channel (or none) and write a caption in that channel's
native style.

Channel audiences:
- whatsapp -> non-technical friends and family. ONLY major mainstream stories a normal
  person would share (huge launches, big money moves, "this changes things for you").
  Very picky: most days have zero qualifying stories.
- facebook -> general tech-curious audience. Consumer-friendly: tools, products,
  practical "how this affects you" stories.
- telegram -> AI insiders. Model releases, benchmarks, research, industry drama.
  Crisp and direct.
- none -> website only. At our volume MOST articles belong here; never pad a channel.

Hard rules:
- Each article gets ONE channel maximum, never two.
- When several articles fit one channel, keep only the strongest; rest go to none.
- Never invent facts; use only what is in the article.
- Captions: plain text, NO markdown symbols, under 60 words, do not repeat the title
  (shown above the caption), do not mention reliability (appended automatically).
  End with a curiosity hook toward the full story + glossary on the site.

Caption tone:
- whatsapp: warm, simple, zero jargon, max 1-2 emoji, like telling a friend
- facebook: conversational, curiosity-driven, ask a question when natural
- telegram: direct, technical, lead with the fact that matters

Return ONLY a JSON array, one object per input article:
[{"id": "<article id>", "platform": "whatsapp|facebook|telegram|none", "caption": "<caption>"}]
"""

def articles_without_routing():
    routed = {r["article_id"] for r in SB.table("social_posts").select("article_id").execute().data}
    recent = SB.table("articles") \
        .select("id,title,summary,reliability,image_url,public_url") \
        .order("created_at", desc=True).limit(60).execute().data
    return [a for a in recent if a["id"] not in routed]

def posts_today(platform):
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    return SB.table("social_posts").select("id", count="exact") \
        .eq("platform", platform).in_("status", ["pending", "posted", "ready"]) \
        .gte("created_at", start).execute().count

def route(unrouted):
    counts = {p: posts_today(p) for p in DAILY_CAPS}
    for i in range(0, len(unrouted), CHUNK):
        batch = unrouted[i:i + CHUNK]
        prompt = EDITOR_PROMPT + "\nArticles:\n" + json.dumps(
            [{"id": a["id"], "title": a["title"], "summary": a["summary"],
              "reliability": a["reliability"]} for a in batch], ensure_ascii=False)
        raw = llm(prompt).strip()
        raw = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", raw)
        try:
            decisions = {d["id"]: d for d in json.loads(raw[raw.find("["):raw.rfind("]") + 1])}
        except Exception:
            print(f"[route] unparseable response, batch retries next run ({len(batch)} articles)")
            continue
        for a in batch:
            d = decisions.get(a["id"], {})
            platform = d.get("platform", "none")
            if platform not in DAILY_CAPS:
                platform = "none"
            if platform != "none" and counts[platform] >= DAILY_CAPS[platform]:
                platform = "none"
            if platform != "none":
                counts[platform] += 1
            SB.table("social_posts").upsert({
                "article_id": a["id"], "platform": platform,
                "caption": d.get("caption", ""),
                "status": "pending" if platform != "none" else "skipped",
            }, on_conflict="article_id").execute()
        print(f"[route] {len(batch)} routed")

def tg_api(method, payload):
    r = requests.post(f"https://api.telegram.org/bot{TG_TOKEN}/{method}", json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["result"]

def full_caption(p):
    a, url = p["articles"], p["articles"].get("public_url") or SITE
    return (f"{a['title']}\n\n{p['caption']}\n\n"
            f"🔎 Reliability: {a['reliability']}\n🔗 Full story + glossary: {url}")

def send_telegram(p):
    text, a = full_caption(p), p["articles"]
    img = a.get("image_url")
    if img:
        try:
            return tg_api("sendPhoto", {"chat_id": TG_CHANNEL, "photo": img,
                                        "caption": text[:1024]})["message_id"]
        except Exception as e:
            print(f"[tg] sendPhoto failed, falling back to text: {e}")
    return tg_api("sendMessage", {"chat_id": TG_CHANNEL, "text": text,
        "link_preview_options": {"url": a.get("public_url") or SITE,
                                 "prefer_small_media": True}})["message_id"]

def send_facebook(p):
    text, a = full_caption(p), p["articles"]
    img = a.get("image_url")
    if img:   # photo post -> image renders large in the feed
        r = requests.post(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}/photos",
            json={"url": img, "caption": text[:2200], "access_token": FB_TOKEN}, timeout=60)
    else:
        r = requests.post(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}/feed",
            json={"message": text, "link": a.get("public_url") or SITE,
                  "access_token": FB_TOKEN}, timeout=60)
    r.raise_for_status()
    return r.json().get("post_id") or r.json()["id"]

def send_whatsapp(p):
    a = p["articles"]
    url = a.get("public_url") or SITE
    if a.get("image_url"):
        try:
            tg_api("sendPhoto", {"chat_id": OWNER_ID, "photo": a["image_url"],
                                 "caption": f"{a['title']}\n\n{p['caption']}"[:1024]})
        except Exception:
            pass
    tg_api("sendMessage", {"chat_id": OWNER_ID, "text":
        "📲 WhatsApp post ready — image above (save/share it), paste this caption:\n\n"
        f"{a['title']}\n\n{p['caption']}\n\n🔎 Reliability: {a['reliability']}\n🔗 {url}"})
    return None

SENDERS = {"telegram": send_telegram, "facebook": send_facebook, "whatsapp": send_whatsapp}

def main():
    unrouted = articles_without_routing()
    if unrouted:
        route(unrouted)
    queue = SB.table("social_posts").select("*, articles(*)") \
        .in_("status", ["pending", "failed"]).lt("attempts", MAX_ATTEMPTS) \
        .order("id").limit(10).execute().data
    failures = 0
    for p in queue:
        try:
            ext_id = SENDERS[p["platform"]](p)
            SB.table("social_posts").update({
                "status": "ready" if p["platform"] == "whatsapp" else "posted",
                "external_id": ext_id,
                "posted_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", p["id"]).execute()
            print(f"#{p['id']} -> {p['platform']}")
        except Exception as e:
            failures += 1
            SB.table("social_posts").update({
                "status": "failed", "error": str(e)[:500],
                "attempts": (p["attempts"] or 0) + 1,
            }).eq("id", p["id"]).execute()
            print(f"FAILED #{p['id']} ({p['platform']}): {e}")
    sys.exit(1 if failures else 0)

if __name__ == "__main__":
    main()
