# post.py — NewsShore social distributor. ZERO AI calls.
# fetch-and-publish.js owns fetch/rewrite/save. This script only:
#   1. picks ONE platform per article (category rules + daily caps)
#   2. posts it as-is: title + summary + the article's own image + link

import os, sys
from datetime import datetime, timezone
import requests
from supabase import create_client
import re
from datetime import datetime, timezone, timedelta

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

DAILY_CAPS   = {"whatsapp": 10, "facebook": 20, "telegram": 40}
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

STOP = {"the","a","an","of","for","and","or","to","in","on","with","new","its","is",
        "are","as","at","by","from","this","that","will","says","said"}

def title_words(t):
    return {w for w in re.sub(r"[^a-z0-9\s]", " ", (t or "").lower()).split()
            if len(w) > 1 and w not in STOP}

def similar(a, b):
    if not a or not b:
        return False
    shared = a & b
    return len(shared) >= 2 and len(shared) / max(len(a), len(b)) >= 0.3

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
    since24 = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    done = (SB.table("social_posts").select("articles(title)")
            .neq("platform", "none").gte("created_at", since24).execute().data)
    seen = [title_words(r["articles"]["title"]) for r in done if r.get("articles")]
    waiting = dups = 0
    for a in unrouted:
        tw = title_words(a["title"])
        if any(similar(tw, prev) for prev in seen):
            dups += 1
            SB.table("social_posts").upsert({"article_id": a["id"], "platform": "none",
                "status": "skipped"}, on_conflict="article_id").execute()
            print(f"[route] duplicate stays website-only: {a['title'][:60]}")
            continue
        platform = pick_platform(a)
        if platform != "none" and not CONFIGURED.get(platform):
            waiting += 1
            continue
        if platform != "none" and counts[platform] >= DAILY_CAPS[platform]:
            platform = "none"
        if platform != "none":
            counts[platform] += 1
            seen.append(tw)
        SB.table("social_posts").upsert({"article_id": a["id"], "platform": platform,
            "status": "pending" if platform != "none" else "skipped"},
            on_conflict="article_id").execute()
    print(f"[route] {len(unrouted) - waiting - dups} decided, {waiting} waiting, {dups} duplicate(s) skipped")
# ---------- senders ----------
def tg_api(method, payload):
    r = requests.post(f"https://api.telegram.org/bot{TG_TOKEN}/{method}", json=payload, timeout=60)
    if not r.ok:
        raise RuntimeError(f"TG {method} -> {r.status_code}: {r.text[:300]}")
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

def fb_call(path, payload):
    r = requests.post(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}/{path}",
                      json=payload, timeout=60)
    if not r.ok:
        raise RuntimeError(f"FB {path} -> {r.status_code}: {r.text[:400]}")
    return r.json()

def send_facebook(p):
    a, caption = p["articles"], build_caption(p["articles"], article_url(p["articles"]))
    if a.get("image_url"):
        try:
            data = fb_call("photos", {"url": a["image_url"], "caption": caption[:2200],
                                      "access_token": FB_TOKEN})
            return data.get("post_id") or data["id"]
        except RuntimeError as e:
            print(f"[fb] photo failed ({e}); image was {a['image_url']}")
            print("[fb] retrying as a link post")
    data = fb_call("feed", {"message": caption, "link": article_url(a),
                            "access_token": FB_TOKEN})
    return data.get("post_id") or data["id"]

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
    per_run = {}
    for p in queue:                                        # queue: change .limit(10) to .limit(15)
        if per_run.get(p["platform"], 0) >= 3:             # max 3 posts per platform per run
            continue                                       # stays pending for the next run
        per_run[p["platform"]] = per_run.get(p["platform"], 0) + 1
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
