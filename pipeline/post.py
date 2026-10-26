# post.py — NewsShore social distributor. ZERO AI calls.
# fetch-and-publish.js owns fetch/rewrite/save. This script only:
#   1. picks ONE platform per article (category rules + daily caps)
#   2. posts it as-is: title + summary + the article's own image + link

import os, sys
from datetime import datetime, timezone
import requests
from supabase import create_client

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

TG_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHANNEL = os.environ.get("TELEGRAM_CHANNEL")
OWNER_ID   = os.environ.get("OWNER_CHAT_ID")     # your DMs — WhatsApp hand-off
FB_PAGE    = os.environ.get("FACEBOOK_PAGE_ID")
FB_TOKEN   = os.environ.get("FACEBOOK_PAGE_TOKEN")
FB_VER     = "v22.0"
SITE       = os.environ.get("SITE_URL", "https://newsshore.com")

CONFIGURED = {   # platforms missing secrets are skipped, never crash the run
    "telegram": bool(TG_TOKEN and TG_CHANNEL),
    "whatsapp": bool(TG_TOKEN and OWNER_ID),
    "facebook": bool(FB_PAGE and FB_TOKEN),
}

DAILY_CAPS   = {"whatsapp": 2, "facebook": 4, "telegram": 6}
MAX_ATTEMPTS = 3

# ---------- routing rules — this is the whole "editor", edit freely ----------
AFRICA = {"nigeria", "south africa", "ghana", "kenya", "africa",
          "egypt", "morocco", "uganda", "tanzania"}

ROUTE_RULES = {
    "AI News":            "telegram",
    "Research":           "telegram",
    "Tech Giants":        "telegram",
    "Mobile & Social":    "facebook",
    "Tech News":          "facebook",
    "Deals":              "facebook",
    "Startups & Funding": "facebook",
    "Global Tech":        "whatsapp",   # refined by region below
}

def pick_platform(a):
    cat = (a.get("category") or "").strip()
    if cat == "Global Tech":
        region = (a.get("region") or "").strip().lower()
        return "whatsapp" if region in AFRICA else "facebook"
    return ROUTE_RULES.get(cat, "none")

REL_LABEL = {"verified": "✅ Verified report", "claimed": "⚠️ Company claim"}

def build_caption(a, url):
    parts = [a["title"], "", (a.get("summary") or "").strip()]
    if a.get("image_credit_name"):
        parts += ["", f"📷 {a['image_credit_name']}"]
    parts += ["", REL_LABEL.get(a.get("reliability"), a.get("reliability") or ""),
              f"🔗 Full story + glossary: {url}"]
    text = "\n".join(parts).strip()
    if len(text) > 1000:            # Telegram photo-caption limit is 1024
        text = f"{a['title']}\n\n{REL_LABEL.get(a.get('reliability'), '')}\n🔗 {url}"
    return text

# ---------- routing ----------
def articles_without_routing():
    routed = {r["article_id"] for r in SB.table("social_posts").select("article_id").execute().data}
    recent = (SB.table("articles")
              .select("id,title,summary,reliability,category,region,image_url,"
                      "image_credit_name,public_url")
              .order("created_at", desc=True).limit(60).execute().data)
    return [a for a in recent if a["id"] not in routed]

def posts_today(platform):
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    return (SB.table("social_posts").select("id", count="exact")
             .eq("platform", platform).in_("status", ["pending", "posted", "ready"])
             .gte("created_at", start).execute().count)

def route(unrouted):
    counts = {p: posts_today(p) for p in DAILY_CAPS}
    for a in unrouted:
        platform = pick_platform(a)
        if platform != "none" and not CONFIGURED.get(platform):
            platform = "none"     # secrets not set yet — website only for now
        if platform != "none" and counts[platform] >= DAILY_CAPS[platform]:
            platform = "none"     # daily cap hit — website only
        if platform != "none":
            counts[platform] += 1
        SB.table("social_posts").upsert({
            "article_id": a["id"],
            "platform": platform,
            "status": "pending" if platform != "none" else "skipped",
        }, on_conflict="article_id").execute()
    print(f"[route] {len(unrouted)} article(s) routed")

# ---------- senders ----------
def tg_api(method, payload):
    r = requests.post(f"https://api.telegram.org/bot{TG_TOKEN}/{method}", json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["result"]

def article_url(a):
    return a.get("public_url") or SITE

def send_telegram(p):
    a, caption = p["articles"], build_caption(p["articles"], article_url(p["articles"]))
    if a.get("image_url"):
        try:
            return tg_api("sendPhoto", {"chat_id": TG_CHANNEL, "photo": a["image_url"],
                                        "caption": caption})["message_id"]
        except Exception as e:
            print(f"[tg] photo failed ({e}) — posting as text")
    return tg_api("sendMessage", {"chat_id": TG_CHANNEL, "text": caption,
        "link_preview_options": {"url": article_url(a), "prefer_small_media": True}})["message_id"]

def send_facebook(p):
    a, caption = p["articles"], build_caption(p["articles"], article_url(p["articles"]))
    if a.get("image_url"):
        r = requests.post(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}/photos",
            json={"url": a["image_url"], "caption": caption[:2200],
                  "access_token": FB_TOKEN}, timeout=60)
    else:
        r = requests.post(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}/feed",
            json={"message": caption, "link": article_url(a),
                  "access_token": FB_TOKEN}, timeout=60)
    r.raise_for_status()
    return r.json().get("post_id") or r.json()["id"]

def send_whatsapp(p):
    a, caption = p["articles"], build_caption(p["articles"], article_url(p["articles"]))
    if a.get("image_url"):
        try:
            tg_api("sendPhoto", {"chat_id": OWNER_ID, "photo": a["image_url"],
                                 "caption": a["title"]})
        except Exception:
            pass
    tg_api("sendMessage", {"chat_id": OWNER_ID, "text":
        "📲 WhatsApp post ready — image above, paste this caption:\n\n" + caption})
    return None

SENDERS = {"telegram": send_telegram, "facebook": send_facebook, "whatsapp": send_whatsapp}

def main():
    for plat, ok in CONFIGURED.items():
        if not ok:
            print(f"[setup] {plat} not configured (missing secrets) — those articles stay website-only")
    unrouted = articles_without_routing()
    if unrouted:
        route(unrouted)
    queue = (SB.table("social_posts").select("*, articles(*)")
             .in_("status", ["pending", "failed"]).lt("attempts", MAX_ATTEMPTS)
             .order("id").limit(10).execute().data)
    failures = 0
    for p in queue:
        try:
            ext_id = SENDERS[p["platform"]](p)
            SB.table("social_posts").update({
                "status": "ready" if p["platform"] == "whatsapp" else "posted",
                "external_id": ext_id,
                "posted_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", p["id"]).execute()
            print(f"[post] #{p['id']} -> {p['platform']}: {p['articles']['title'][:60]}")
        except Exception as e:
            failures += 1
            SB.table("social_posts").update({
                "status": "failed", "error": str(e)[:500],
                "attempts": (p["attempts"] or 0) + 1,
            }).eq("id", p["id"]).execute()
            print(f"[FAIL] #{p['id']} ({p['platform']}): {e}")
    sys.exit(1 if failures else 0)   # nonzero exit -> the alert step DMs you

if __name__ == "__main__":
    main()
