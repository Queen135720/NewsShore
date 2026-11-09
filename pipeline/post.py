# post.py — NewsShore social distributor. ZERO AI calls.
# fetch-and-publish.js owns fetch/rewrite/save. This script only:
#   1. picks ONE platform per article (category rules + daily caps)
#   2. cleans it into a human-looking post (markdown stripped, pure regex)
#   3. posts it: title + short teaser + the article's own image + link
# Platforms: Telegram (bot API), WhatsApp Channels (Whapi.Cloud), Facebook (Graph API)

import os, sys, time
from datetime import datetime, timezone
import requests
from supabase import create_client
import re
from datetime import datetime, timezone, timedelta

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

TG_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHANNEL = os.environ.get("TELEGRAM_CHANNEL")
FB_PAGE    = os.environ.get("FACEBOOK_PAGE_ID")
FB_TOKEN   = os.environ.get("FACEBOOK_PAGE_TOKEN")
FB_VER     = "v22.0"
WHAPI_TOKEN = os.environ.get("WHAPI_TOKEN")           # Whapi.Cloud gateway token
WA_CHANNEL  = os.environ.get("WHATSAPP_CHANNEL_ID")   # e.g. 123456789@newsletter
WHAPI       = "https://gate.whapi.cloud"
SITE        = os.environ.get("SITE_URL", "https://newsshore.com")

CONFIGURED = {   # platforms missing secrets are skipped, never crash the run
    "telegram": bool(TG_TOKEN and TG_CHANNEL),
    "whatsapp": bool(WHAPI_TOKEN and WA_CHANNEL),
    "facebook": bool(FB_PAGE and FB_TOKEN),
}

DAILY_CAPS   = {"whatsapp": 10, "facebook": 20, "telegram": 40}
MAX_ATTEMPTS = 3

# ---------- routing rules — this is the whole "editor", edit freely ----------
AFRICA = {"nigeria", "south africa", "ghana", "kenya", "africa",
          "egypt", "morocco", "uganda", "tanzania"}

ROUTE_RULES = {
    "AI News":            "telegram", "facebook", "whatsapp"
    "Research":           "telegram", "facebook",
    "Tech Giants":        "telegram"," facebook", "whatsapp"
    "Mobile & Social":    "telegram",
    "Tech News":          "facebook", "telegram",
    "Deals":              "facebook",
    "Startups & Funding": "facebook",
    "Global Tech":        "whatsapp", "facebook",  # refined by region below
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

# ---------- url helpers ----------
def slugify(title):
    s = re.sub(r"[^a-z0-9\s-]", "", (title or "").lower())
    s = re.sub(r"[\s-]+", "-", s).strip("-")
    return (s[:80] or "article").rstrip("-")

# ---------- text cleanup: kill the "AI look" (pure regex, still zero AI) ------
# Bodies in Supabase are markdown (## headers, **bold**, bullets) — printed
# literally they scream "AI". This layer turns them back into plain
# human-looking prose before anything goes out.
CHAR_FIX = {
    "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2212": "-",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2026": "...", "\u00a0": " ",
    "\u200b": "", "\u200c": "", "\u200d": "", "\ufeff": "",
}
SCAFFOLD = re.compile(
    r"^(what|why|how)\s+[^.]{0,60}\?$"
    r"|.{0,40}\b(overview|background|introduction|details?|summary|conclusion|"
    r"final\s+thoughts|bottom\s+line|takeaways?|implications?|analysis|outlook)\b",
    re.I)
MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
TELL_PREFIX = re.compile(
    r"^(this\s+(article|piece|post|story|report)\s+"
    r"(discusses|covers|explores|examines|delves\s+into|highlights|"
    r"looks\s+at|breaks\s+down|explains))\b[.,:;\-\u2014]*\s*", re.I)

def clean_chars(s):
    for bad, good in CHAR_FIX.items():
        s = s.replace(bad, good)
    return s

def strip_md(line):
    """Remove inline markdown markers, keep the words."""
    line = MD_LINK.sub(r"\1", line)
    line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
    line = re.sub(r"__(.+?)__", r"\1", line)
    line = re.sub(r"(?<!\w)\*([^*\n]+?)\*(?!\w)", r"\1", line)
    line = re.sub(r"~~(.+?)~~", r"\1", line)
    return line.replace("`", "").strip()

def humanize(text):
    """Markdown-free, scaffold-free, human-sounding paragraphs.
    Drops '##' headers, bold-only pseudo-headers and 'Overview'-style
    section titles; flattens bullets into plain sentences."""
    text = clean_chars((text or "").replace("\r\n", "\n"))
    text = TELL_PREFIX.sub("", text, count=1)
    paras, para = [], []
    def close():
        if para:
            s = re.sub(r"\s+", " ", " ".join(para)).strip()
            if s:
                paras.append(s)
            para.clear()
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            close()
            continue
        if line.startswith("|") or re.match(r"^[-=_*]{3,}$", line):
            continue                                   # tables / divider lines
        if re.match(r"^#{1,6}(\s|$)", line):
            close(); continue                           # markdown header -> gone
        m = re.match(r"^[-*\u2022]\s+(.*)$", line) or re.match(r"^\d+[.)]\s+(.*)$", line)
        if m:                                            # bullet -> plain sentence
            piece = strip_md(m.group(1))
            if piece:
                if piece[0].islower():
                    piece = piece[0].upper() + piece[1:]
                if piece[-1] not in ".!?":
                    piece += "."
                para.append(piece)
            continue
        piece = strip_md(line.lstrip("> "))
        if not piece:
            continue
        bold_only = re.match(r"^\*{1,2}[^*]{0,100}\*{1,2}:?$", line)
        if bold_only and ("." not in piece or piece.endswith(":") or SCAFFOLD.match(piece)):
            close(); continue                           # bold pseudo-header -> gone
        if len(piece) <= 90 and "." not in piece and SCAFFOLD.match(piece):
            close(); continue                           # 'Overview' title line -> gone
        para.append(piece)
    close()
    return re.sub(r"\n{3,}", "\n\n", "\n\n".join(paras)).strip()

def clip_sentences(text, cap):
    """Cut at the last full sentence that fits — never mid-sentence."""
    if len(text) <= cap:
        return text
    best = 0
    for m in re.finditer(r"[.!?][\"']?(\s|$)", text):
        if m.end() > cap:
            break
        best = m.end()
    if best:
        return text[:best].strip()
    space = text.rfind(" ", 0, cap)
    return (text[:space] if space > cap // 2 else text[:cap]).strip()

TEXT_CAP = 600   # chars of story text per post — tune freely

def build_caption(a, url):
    title = re.sub(r"\s+", " ", strip_md(clean_chars(a.get("title") or ""))).strip().upper()
    src = (a.get("summary") or "").strip()
    if len(src) < 60:                    # weak/missing summary -> article body
        src = (a.get("body") or "").strip()
    text = humanize(src)
    if not text:
        text = "Full story on the site."
    text = text[:1].upper() + text[1:]
    text = clip_sentences(text, TEXT_CAP)
    return f"{title}\n\n{text}\n\nGet full story 👉 {url}"

def split_chunks(text, first_limit=1024, limit=4096):
    """Split long text: chunk 1 fits a Telegram photo caption, the rest fit
    Telegram text messages. Cuts at word/newline boundaries, never mid-word."""
    chunks, rest, cap = [], text.strip(), first_limit
    while rest:
        piece = rest[:cap]
        cut = max(rest.rfind("\n", 0, cap), rest.rfind(" ", 0, cap))
        if cut > cap // 2:
            piece = rest[:cut]
        chunks.append(piece.strip())
        rest = rest[len(piece):].lstrip()
        cap = limit
    return [c for c in chunks if c]

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
    """Unique permanent link for this article — generated once, stored in the
    DB (articles.public_url) so the website serves exactly the URLs already
    posted to socials."""
    if a.get("public_url"):
        return a["public_url"]
    url = f"{SITE.rstrip('/')}/article/{slugify(a['title'])}-{str(a['id'])[:8]}"
    SB.table("articles").update({"public_url": url}).eq("id", a["id"]).execute()
    return url

def send_telegram(p):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    if a.get("image_url"):
        try:
            chunks = split_chunks(caption)
            msg_id = tg_api("sendPhoto", {"chat_id": TG_CHANNEL, "photo": a["image_url"],
                                          "caption": chunks[0]})["message_id"]
            try:
                for chunk in chunks[1:]:
                    tg_api("sendMessage", {"chat_id": TG_CHANNEL, "text": chunk})
            except Exception as e:
                print(f"[tg] continuation failed ({e}) — post stays marked as sent")
            return msg_id
        except Exception as e:
            print(f"[tg] photo failed ({e}) — posting as text")
    for chunk in split_chunks(caption, first_limit=4096):
        tg_api("sendMessage", {"chat_id": TG_CHANNEL, "text": chunk})
    return None

def fb_call(path, payload):
    r = requests.post(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}/{path}",
                      json=payload, timeout=60)
    if not r.ok:
        raise RuntimeError(f"FB {path} -> {r.status_code}: {r.text[:400]}")
    return r.json()

def send_facebook(p):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    if a.get("image_url"):
        try:
            data = fb_call("photos", {"url": a["image_url"], "caption": caption[:5000],
                                      "access_token": FB_TOKEN})
            return data.get("post_id") or data["id"]
        except RuntimeError as e:
            print(f"[fb] photo failed ({e}); image was {a['image_url']}")
            print("[fb] retrying as a link post")
    data = fb_call("feed", {"message": caption, "link": article_url(a),
                            "access_token": FB_TOKEN})
    return data.get("post_id") or data["id"]

def whapi_call(path, payload):
    r = requests.post(f"{WHAPI}/{path}",
                      headers={"Authorization": f"Bearer {WHAPI_TOKEN}",
                               "Accept": "application/json"},
                      json=payload, timeout=60)
    if not r.ok:
        raise RuntimeError(f"WA {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()

def send_whatsapp(p):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    # Whapi's docs name the recipient field `message` on /messages/text but
    # `to` on /messages/image — we send BOTH keys with the same value;
    # unknown extras are ignored, so this works either way.
    if a.get("image_url"):
        try:
            data = whapi_call("messages/image",
                              {"to": WA_CHANNEL, "message": WA_CHANNEL,
                               "media": a["image_url"], "caption": caption[:1024]})
            time.sleep(5)            # spacing — look human, not like a blast tool
            return data.get("id") or "sent"
        except RuntimeError as e:
            print(f"[wa] image failed ({e}) — sending as text")
    data = whapi_call("messages/text",
                      {"to": WA_CHANNEL, "message": WA_CHANNEL,
                       "body": caption[:3500]})
    time.sleep(5)
    return data.get("id") or "sent"

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
                "status": "posted",
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
