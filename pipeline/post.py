# post.py — NewsShore social distributor. ZERO AI calls.
# fetch-and-publish.js owns fetch/rewrite/save. This script only:
#   1. picks the PLATFORM LIST for each article (category rules + daily caps)
#      -> one social_posts row per (article, platform): a big story can hit
#         telegram + facebook + whatsapp at once
#   2. cleans it into a human-looking post (markdown stripped, pure regex)
#   3. snips the article's card off the live website (a real browser
#      screenshot — no AI touch, pixel-identical to what readers see) and
#      uploads it to Supabase storage; platforms that take an image URL get
#      the snip instead of the raw hero image
#   4. posts it: summary lede, blank line, ~70% of the article body, link
#   5. HARD duplicate guard: a (article, platform) pair that already went out
#      in the last 48h can never be sent again, no matter what routing did
# Only articles saved within PICKUP_WINDOW_H hours are ever routed (latest
# content only — no old backlog drains).

import os, sys, time, json
from datetime import datetime, timezone
import requests
from supabase import create_client
import re
from datetime import datetime, timezone, timedelta

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

TG_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHANNEL = os.environ.get("TELEGRAM_CHANNEL")
OWNER_ID   = os.environ.get("OWNER_CHAT_ID")     # DMs: failure alert with error text
FB_PAGE    = os.environ.get("FACEBOOK_PAGE_ID")
FB_TOKEN   = os.environ.get("FACEBOOK_PAGE_TOKEN")
FB_VER     = "v22.0"
SITE       = os.environ.get("SITE_URL", "https://newsshore.vercel.app")

# ---- WhatsApp gateway: self-hosted Evolution API (free) or Whapi.Cloud ----
# WA_PROVIDER picks the gateway explicitly; by default it is "evolution" as
# soon as EVOLUTION_URL is set, and falls back to "whapi" (legacy) otherwise.
#   Evolution needs: EVOLUTION_URL (http://your-vps-ip:8080),
#   EVOLUTION_API_KEY (= AUTHENTICATION_API_KEY in the server's .env),
#   EVOLUTION_INSTANCE (the instance name you create there).
# Both providers use WHATSAPP_CHANNEL_ID — the channel JID, e.g.
# 123456789@newsletter, taken from the channel invite link
# (https://whatsapp.com/channel/<id>  ->  "<id>@newsletter").
WA_CHANNEL   = os.environ.get("WHATSAPP_CHANNEL_ID")
WHAPI_TOKEN  = os.environ.get("WHAPI_TOKEN")      # legacy Whapi.Cloud token
WHAPI        = "https://gate.whapi.cloud"
EVO_URL      = os.environ.get("EVOLUTION_URL", "").rstrip("/")
EVO_KEY      = os.environ.get("EVOLUTION_API_KEY")
EVO_INSTANCE = os.environ.get("EVOLUTION_INSTANCE")
WA_PROVIDER  = (os.environ.get("WA_PROVIDER") or
                ("evolution" if EVO_URL else "whapi" if WHAPI_TOKEN else "")).lower()

WA_CONFIG_OK = (bool(WA_CHANNEL) and
                (all([EVO_URL, EVO_KEY, EVO_INSTANCE])
                 if WA_PROVIDER == "evolution" else bool(WHAPI_TOKEN)))
CONFIGURED = {   # platforms missing secrets are skipped, never crash the run
    "telegram": bool(TG_TOKEN and TG_CHANNEL),
    "whatsapp": WA_CONFIG_OK,
    "facebook": bool(FB_PAGE and FB_TOKEN),
}

DAILY_CAPS   = {"whatsapp": 130, "facebook": 150, "telegram": 170}
MAX_ATTEMPTS = 3
PICKUP_WINDOW_H = 2     # only articles saved within this many hours get posted
RUN_CAPS     = {"telegram": 7, "facebook": 5, "whatsapp": 3}   # max posts per platform per run

# ---- card snip (social image = the article card exactly as on the website) --
# SNIP=True captures each article's card from the live site with a headless
# browser and uploads it to Supabase storage; the raw hero image stays the
# fallback for every platform. No image editing, no AI — a real screenshot.
#   SITE_URL   where the site lives (https://newsshore.vercel.app today; the
#              custom domain later — one secret change, no code change)
#   SNIP_BUCKET storage bucket for the snips; created public on first use
#   SNIP_CACHE_H hours a stored snip stays valid (site shows "18m ago" etc.,
#              so refresh it while the article is fresh enough to post)
SNIP_ENABLED = os.environ.get("SNIP_ENABLED", "1") not in ("0", "false", "no")
SNIP_BUCKET  = os.environ.get("SNIP_BUCKET", "social-cards")
SNIP_CACHE_H = 6
SNIP_TIMEOUT_MS   = 45000     # page-load budget per article
SNIP_DEADLINE_S   = 240       # whole-run budget for ALL snips combined
SNIP_JPEG_QUALITY = 90

# Errors that mean "this platform's SECRET/CONFIG is broken" (not the article
# being bad): dead token, wrong channel ID, unlinked number, trial limit.
# When one of these hits, the platform is tripped for the rest of the run so
# its pending rows keep their retry attempts alive while you fix the secret.
CONFIG_ERR = re.compile(
    r"-> 4(01|02|03|04)\b"
    r"|Error validating access token|session has been invalidated"
    r"|Channel not found|Need channel authorization|Trial version limit"
    r"|Instance not found|not connected|invalid api", re.I)

# ---------- routing rules — this is the whole "editor", edit freely ----------
# Each category maps to a LIST of platforms: the article goes to ALL of them
# (one social_posts row per platform, each under its own daily cap).
AFRICA = {"nigeria", "south africa", "ghana", "kenya", "africa",
          "egypt", "morocco", "uganda", "tanzania"}

ROUTE_RULES = {
    "AI News":            ["telegram", "facebook", "whatsapp"],
    "Research":           ["telegram", "facebook"],
    "Tech Giants":        ["telegram", "facebook", "whatsapp"],
    "Mobile & Social":    ["telegram"],
    "Tech News":          ["facebook", "telegram"],
    "Deals":              ["facebook"],
    "Startups & Funding": ["facebook"],
    "Global Tech":        ["whatsapp", "facebook"],
}
# NOTE: "Global Tech" now goes to WhatsApp regardless of region. To restore
# the old Africa-only WhatsApp gate, replace pick_platforms' Global Tech
# branch with:
#   region = (a.get("region") or "").strip().lower()
#   return ["whatsapp", "facebook"] if region in AFRICA else ["facebook"]

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

def pick_platforms(a):
    cat = (a.get("category") or "").strip()
    if cat == "Global Tech":
        return ["whatsapp", "facebook"]
    return ROUTE_RULES.get(cat, [])

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

BODY_SHARE    = 0.70   # share of the article body that goes into a social post
BODY_HARD_CAP = 4500   # ceiling sized so the FB photo-caption slice keeps the link line
BODY_MIN      = 80     # below this the body is too thin to feed the post

def build_caption(a, url):
    """Post layout: summary (the short hook that shows before "See more"),
    one blank line, then the body. No headline — the summary is short enough
    to preview whole on Facebook, and a headline on top just buried it."""
    summary = re.sub(r"\s+", " ", strip_md(clean_chars(a.get("summary") or ""))).strip()
    body = humanize((a.get("body") or "").strip())
    if summary and len(body) < BODY_MIN:      # body too thin to post separately
        body = ""
    if not summary and body:                  # no summary: first sentence is the lede
        m = re.match(r".+?[.!?](?:\s|$)", body)
        if m and len(body) > BODY_MIN:
            summary, body = m.group(0).strip(), body[m.end():].strip()
    if not summary and not body:
        return f"Get the full article 👉 {url}"
    if body:
        body = body[:1].upper() + body[1:]
        # ~70% of the body, always ending on a full sentence, never mid-word.
        body = clip_sentences(body, min(BODY_HARD_CAP, max(200, int(len(body) * BODY_SHARE))))
    # Layout guard: summary and body must never blend into one paragraph.
    sep = "\n\n" if (summary and body) else ""
    return f"{summary}{sep}{body}\n\nGet the full article 👉 {url}".strip()

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
    """Latest content only: articles saved within PICKUP_WINDOW_H, that are
    still missing at least one of their target platforms (or not routed at
    all). Fully routed articles and skipped/duplicate ones never reappear."""
    # BOUNDED by 48h on purpose: Supabase caps any single select at 1000 rows,
    # so an unbounded scan goes blind once the table grows — that blind spot
    # is exactly what used to re-route already-posted rows (channel dupes).
    # Rows are always created minutes after their article, so 48h safely
    # covers anything the 2h pickup window can still consider.
    since48 = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    rows = (SB.table("social_posts").select("article_id,platform")
            .gte("created_at", since48).execute().data)
    dead = {r["article_id"] for r in rows if r.get("platform") == "none"}
    have = {}
    for r in rows:
        if r.get("platform") and r["platform"] != "none":
            have.setdefault(r["article_id"], set()).add(r["platform"])
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=PICKUP_WINDOW_H)).isoformat()
    recent = (SB.table("articles")
              .select("id,title,summary,reliability,category,region,image_url,"
                      "image_credit_name,public_url")
              .gte("created_at", cutoff)
              .order("created_at", desc=True).limit(60).execute().data)
    out = []
    for a in recent:
        if a["id"] in dead:
            continue
        targets = pick_platforms(a)
        if not targets or (set(targets) - have.get(a["id"], set())):
            out.append(a)
    return out

def posts_today(platform):
    """Rows that can still consume a send slot today: already-posted ones plus
    LIVE pendings (attempts < MAX_ATTEMPTS). Dead pendings can never post
    again — the queue skips them — so they must not eat cap quota either;
    counting them is exactly what locked facebook out for a whole day while
    its token was broken: 20 dead rows -> cap full -> everything 'waiting'."""
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    posted = (SB.table("social_posts").select("id", count="exact")
               .eq("platform", platform).in_("status", ["posted", "ready"])
               .gte("created_at", start).execute().count)
    live = (SB.table("social_posts").select("id", count="exact")
              .eq("platform", platform).eq("status", "pending")
              .gte("created_at", start).lt("attempts", MAX_ATTEMPTS).execute().count)
    return (posted or 0) + (live or 0)
def write_row(payload):
    """Upsert on (article_id, platform). If the DB lacks that unique
    constraint PostgREST 400s on the on_conflict clause — fall back to a
    plain insert (the existing-set guard below already proved the pair is
    new, so an insert cannot duplicate it)."""
    try:
        SB.table("social_posts").upsert(payload, on_conflict="article_id,platform").execute()
    except Exception:
        SB.table("social_posts").insert(payload).execute()

def route(unrouted):
    counts = {p: posts_today(p) for p in DAILY_CAPS}
    since24 = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    done = (SB.table("social_posts").select("article_id,articles(title)")
            .neq("platform", "none").gte("created_at", since24).execute().data)
    seen = [(r["article_id"], title_words(r["articles"]["title"]))
            for r in done if r.get("articles")]
    # Same 48h bound as articles_without_routing — the 1000-row cap must never
    # make this set blind to today's rows.
    since48 = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    existing = {(r["article_id"], r["platform"]) for r in
                (SB.table("social_posts").select("article_id,platform")
                 .gte("created_at", since48).execute().data)}
    routed = queued = waiting = dups = 0
    capped = set()   # platforms whose daily cap filled up (visible in the log)
    for a in unrouted:
        tw = title_words(a["title"])
        # dedup vs OTHER articles only — this article's own earlier rows
        # (e.g. telegram row from a previous run) must never count as a dup
        if any(aid != a["id"] and similar(tw, prev) for aid, prev in seen):
            dups += 1
            write_row({"article_id": a["id"], "platform": "none",
                       "status": "skipped"})
            print(f"[route] duplicate stays website-only: {a['title'][:60]}")
            continue
        platforms = pick_platforms(a)
        if not platforms:
            write_row({"article_id": a["id"], "platform": "none",
                       "status": "skipped"})
            continue
        made = False
        for plat in platforms:
            if (a["id"], plat) in existing:
                continue                    # already routed/posted there earlier
            if not CONFIGURED.get(plat):
                waiting += 1
                continue                    # secret missing -> retried when it returns
            if counts[plat] >= DAILY_CAPS[plat]:
                capped.add(plat)             # cap full for the day — say so, don't hide it
                continue                    # daily cap hit -> retried within the window
            counts[plat] += 1
            write_row({"article_id": a["id"], "platform": plat,
                       "status": "pending"})
            existing.add((a["id"], plat))
            queued += 1
            made = True
        on_now = [p for p in platforms if (a["id"], p) in existing]
        missing = [p for p in platforms if p not in on_now]
        # a platform lands in "waiting" for exactly one of three reasons:
        # secret missing, daily cap full, or duplicate-content skip — name it,
        # so "(waiting: facebook)" never becomes a guessing game again
        missing = [
            f"{p} (cap {counts[p]}/{DAILY_CAPS[p]} full)" if p in capped
            else f"{p} (not configured)" if not CONFIGURED.get(p)
            else p
            for p in missing
        ]
        extra = f"  (waiting: {', '.join(missing)})" if missing else ""
        print(f"[route] {a['title'][:55]} -> {', '.join(on_now) or 'none'}{extra}")
        if made:
            routed += 1
            seen.append((a["id"], tw))
    print(f"[route] {routed} article(s) routed -> {queued} post(s) queued, "
          f"{waiting} platform slot(s) waiting, {dups} duplicate(s) skipped")
    for p in sorted(capped):
        print(f"[route] {p}: daily cap {DAILY_CAPS[p]} full "
              f"({counts[p]} posted/live rows today) — resumes after UTC midnight; "
              f"clean dead rows with: update social_posts set status='expired' "
              f"where status='pending' and attempts>=3;")

# ---------- card snip: social image = the website's own article card ----------
# The site renders every article as a card: photo on top, white info block
# under it (title, minute read, country, freshness). That card IS the brand.
# We load the site in a real headless browser, find the card for THIS
# article, and screenshot the element — pixel-identical to what a reader
# sees, with zero AI retouching (the reason this layer exists).
# Matching: card <img> src == the article's image_url from Supabase; if the
# src carries tracking junk after the path, a title-prefix match is the
# fallback. The newest article sits in the dark hero slot (article.bg-gray-900)
# instead of the white grid — handled too. Anything off (site down, card
# missing, browser missing, storage refusing) falls back to the raw hero
# image, so a snip problem can never block a post.
from playwright.sync_api import sync_playwright, Error as PWError
def _norm_img(u):
    """Comparable form of an image URL: strip query/fragment tracking junk."""
    if not u:
        return ""
    u = re.sub(r"[?#].*$", "", u.strip())
    return u.rstrip("/").lower()

# per-run in-memory snip memo: article_id -> (url, when). Survives missing
# DB cache columns and keeps a triple-platform article to one capture.
_SNIP_MEMO = {}

def _snip_filename(article):
    aid = str(article["id"])
    return f"{aid}.jpg"

def _snip_cache_ok(article):
    """A stored snip is reusable while it is fresh enough (the card shows
    '18m ago' style freshness text, so stale snips would lie)."""
    try:
        rows = (SB.table("articles").select("card_image_url,card_snipped_at")
                .eq("id", article["id"]).limit(1).execute().data)
        if not rows or not rows[0].get("card_image_url"):
            return None
        snipped = rows[0].get("card_snipped_at")
        if snipped:
            age_h = (datetime.now(timezone.utc)
                     - datetime.fromisoformat(snipped.replace("Z", "+00:00"))
                     ).total_seconds() / 3600
            if age_h <= SNIP_CACHE_H:
                return rows[0]["card_image_url"]
        # no timestamp (or stale) -> not cache-ok, but keep URL for upsert
        return None
    except Exception:
        return None

_SNIP_JS = """() => {
    // find the article card whose <img> matches the target (query string
    // stripped on both sides — Unsplash/Verge URLs carry tracking params);
    // if that fails, the first card whose heading starts with the title prefix
    const norm = u => (u || '').split(/[?#]/)[0].replace(/\\/+$/, '').toLowerCase();
    const target = norm(IMG);
    const prefix = (PREFIX || '').toLowerCase();
    const arts = [...document.querySelectorAll('article')];
    let card = null, how = '';
    if (target) {
        const hit = arts.find(a => {
            const im = a.querySelector('img');
            return im && norm(im.getAttribute('src')) === target;
        });
        if (hit) { card = hit; how = 'image'; }
    }
    if (!card && prefix) {
        const hit = arts.find(a => {
            const h = a.querySelector('h1,h2,h3,h4');
            return h && h.textContent.trim().toLowerCase().startsWith(prefix);
        });
        if (hit) { card = hit; how = 'title'; }
    }
    if (!card) return null;
    const im = card.querySelector('img');
    const r = card.getBoundingClientRect();
    return { found: true, how,
             hasImg: !!(im && im.complete && im.naturalWidth > 0),
             w: Math.round(r.width), h: Math.round(r.height),
             title: (card.querySelector('h1,h2,h3,h4') || {}).innerText || null };
}"""

def _snip_one(page, article):
    """Locate this article's card on the homepage grid and return its PNG bytes.
    Returns None (and prints why) whenever the card can't be matched."""
    img_url = article.get("image_url") or ""
    prefix = (article.get("title") or "").strip().lower()[:28]
    js = _SNIP_JS.replace("IMG", json.dumps(img_url)).replace("PREFIX", json.dumps(prefix))
    try:
        hit = page.evaluate(js)
    except PWError as e:
        print(f"[snip] evaluate failed on {article['title'][:40]!r}: {e}")
        return None
    if not hit or not hit.get("found"):
        print(f"[snip] no card matched for {article['title'][:40]!r} "
              f"(image {img_url[:60]}) — using raw image")
        return None
    print(f"[snip] matched card by {hit['how']} ({hit['w']}x{hit['h']}px): "
          f"{article['title'][:50]!r}")
    # re-locate the card as an element handle via the same match rule, so the
    # screenshot targets exactly what the JS matcher found (image match first,
    # title-prefix fallback — the newest article sits in the dark hero slot
    # with a different img src than the grid card, and must still snip)
    handle = page.evaluate_handle(
        """([img, prefix]) => {
            const norm = u => (u || '').split(/[?#]/)[0].replace(/\\/+$/, '').toLowerCase();
            const arts = [...document.querySelectorAll('article')];
            let card = null;
            if (img) {
                card = arts.find(a => {
                    const im = a.querySelector('img');
                    return im && norm(im.getAttribute('src')) === norm(img);
                });
            }
            if (!card && prefix) {
                card = arts.find(a => {
                    const h = a.querySelector('h1,h2,h3,h4');
                    return h && h.textContent.trim().toLowerCase().startsWith(prefix);
                });
            }
            return card || null;
        }""", [img_url, prefix])
    card = handle.as_element()
    if card is None:
        print(f"[snip] card vanished before screenshot for {article['title'][:40]!r}")
        return None
    try:
        # scroll first so lazy-loading kicks in, THEN wait for the photo
        card.scroll_into_view_if_needed()
        page.wait_for_function(
            "el => { const im = el.querySelector('img');"
            "        return im && im.complete && im.naturalWidth > 0; }",
            arg=card, timeout=15000)
        png = card.screenshot(type="png")
    except PWError as e:
        print(f"[snip] capture failed for {article['title'][:40]!r}: {str(e)[:120]}")
        return None
    finally:
        handle.dispose()
    print(f"[snip] captured card: {article['title'][:50]}")
    return png

def _snip_upload(data, path, ctype):
    """JPEG/PNG bytes -> public Supabase storage URL. Bucket auto-created
    public on first use. Returns None on any failure (callers fall back to
    the raw image)."""
    try:
        try:
            SB.storage.get_bucket(SNIP_BUCKET)
        except Exception:
            SB.storage.create_bucket(SNIP_BUCKET, options={"public": True})
        bucket = SB.storage.from_(SNIP_BUCKET)
        try:    # upsert: a re-snipped card replaces its own earlier file
            bucket.upload(path, data,
                          {"content-type": ctype, "upsert": "true",
                           "cache-control": "public, max-age=3600"})
        except Exception as up_err:
            # older storage3: same key already exists and upsert flag dropped
            if "Duplicate" in str(up_err) or "already exists" in str(up_err):
                bucket.update(path, data, {"content-type": ctype,
                                           "cache-control": "public, max-age=3600"})
            else:
                raise
        return bucket.get_public_url(path)
    except Exception as e:
        print(f"[snip] storage unavailable ({str(e)[:120]}) — using raw image")
        return None

def _snip_bytes_to_jpeg(png_bytes):
    """Crop nothing, change nothing — just re-encode PNG bytes as JPEG to keep
    the upload small. If PIL isn't installed (CI keeps the image slim), the
    PNG goes up as-is; every platform accepts PNG too."""
    try:
        from PIL import Image
        import io
        im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=SNIP_JPEG_QUALITY)
        return buf.getvalue(), "image/jpeg"
    except Exception:
        return png_bytes, "image/png"

def snip_card(article, browser_ctx):
    """Public entry: fresh snip for this article, or its cached one.
    Returns a public URL (snip or cached) or None (fall back to raw image)."""
    if not SNIP_ENABLED:
        return None
    # per-run memo first: a triple-platform article snips ONCE even if the
    # DB cache columns are missing or the DB write failed
    memo = _SNIP_MEMO.get(article["id"])
    if memo and (datetime.now(timezone.utc) - memo[1]).total_seconds() < SNIP_CACHE_H * 3600:
        return memo[0]
    cached = _snip_cache_ok(article)
    if cached:
        return cached
    # site must be up and the article must actually have an image to snip
    if not article.get("image_url"):
        return None
    try:
        page = browser_ctx.new_page()
        try:
            page.emulate_media(reduced_motion="reduce")
            page.goto(SITE.rstrip("/"), wait_until="domcontentloaded",
                      timeout=SNIP_TIMEOUT_MS)
            page.wait_for_selector("article img", timeout=30000)
            page.wait_for_timeout(2000)
            png = _snip_one(page, article)
        finally:
            page.close()
        if not png:
            return None
        data, ctype = _snip_bytes_to_jpeg(png)
        path = _snip_filename(article)
        url = _snip_upload(data, path, ctype)
        if url:
            _SNIP_MEMO[article["id"]] = (url, datetime.now(timezone.utc))
            try:
                SB.table("articles").update({
                    "card_image_url": url,
                    "card_snipped_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", article["id"]).execute()
            except Exception:
                pass    # cache write is best-effort; the snip still posts
        return url
    except PWError as e:
        print(f"[snip] browser error on {article['title'][:40]!r}: {str(e)[:150]}")
        return None
    except Exception as e:
        print(f"[snip] failed for {article['title'][:40]!r} ({str(e)[:120]}) — using raw image")
        return None

# ---------- senders ----------
def tg_api(method, payload):
    r = requests.post(f"https://api.telegram.org/bot{TG_TOKEN}/{method}", json=payload, timeout=60)
    if not r.ok:
        raise RuntimeError(f"TG {method} -> {r.status_code}: {r.text[:300]}")
    return r.json()["result"]

def article_url(a):
    """Canonical article link: /article/<uuid> — the format the website
    actually serves. Older rows generated slug-style URLs
    (/article/tech-gift-guide-for-dads-2026-4a3f786d) that don't resolve;
    each one self-heals in the DB the first time its article posts again."""
    aid = str(a["id"])
    if a.get("public_url") and a["public_url"].rstrip("/").endswith("/article/" + aid):
        return a["public_url"]
    url = f"{SITE.rstrip('/')}/article/{aid}"
    SB.table("articles").update({"public_url": url}).eq("id", aid).execute()
    return url

def send_telegram(p, snip_url=None):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    photo = snip_url or a.get("image_url")
    if photo:
        try:
            chunks = split_chunks(caption)
            msg_id = tg_api("sendPhoto", {"chat_id": TG_CHANNEL, "photo": photo,
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

def fb_preflight():
    """One cheap authenticated GET before any posting. A dead FB token is the
    one failure that looks like silence ('waiting facebook' forever) — so we
    catch it here: the Action log gets the exact Graph error, the owner gets a
    DM, and facebook is tripped for the run so pending rows keep their attempts
    instead of burning them. Returns True when facebook should be tripped."""
    try:
        r = requests.get(f"https://graph.facebook.com/{FB_VER}/{FB_PAGE}",
                         params={"fields": "id,name", "access_token": FB_TOKEN},
                         timeout=30)
    except Exception as e:
        print(f"[setup] FB preflight network error ({e}) — trying to post anyway")
        return False
    if r.ok:
        print(f"[setup] facebook token OK — page: {r.json().get('name', FB_PAGE)}")
        return False
    if r.status_code >= 500:
        print(f"[setup] FB preflight got {r.status_code} (Facebook-side hiccup) — trying to post anyway")
        return False
    try:                                   # 4xx = our secret/config is wrong
        msg = r.json().get("error", {}).get("message", r.text[:200])
    except Exception:
        msg = r.text[:200]
    print(f"[setup] FACEBOOK TOKEN DEAD -> {msg}")
    print("[setup] facebook tripped for this run — its posts stay pending until the secret is fixed")
    if OWNER_ID and TG_TOKEN:
        try:                               # same DM channel as failure alerts
            tg_api("sendMessage", {"chat_id": OWNER_ID,
                   "text": f"\u26a0\ufe0f NewsShore: Facebook token failed preflight — FB posts are waiting.\n"
                           f"{msg[:200]}"})
        except Exception:
            pass                           # alerting must never crash the run
    return True

def send_facebook(p, snip_url=None):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    photo = snip_url or a.get("image_url")
    if photo:
        try:
            data = fb_call("photos", {"url": photo, "caption": caption[:5000],
                                      "access_token": FB_TOKEN})
            return data.get("post_id") or data["id"]
        except RuntimeError as e:
            if CONFIG_ERR.search(str(e)):
                raise               # token dead -> the link post would fail too
            print(f"[fb] photo failed ({e}); image was {photo}")
            print("[fb] retrying as a link post")
    data = fb_call("feed", {"message": caption, "link": article_url(a),
                            "access_token": FB_TOKEN})
    return data.get("post_id") or data["id"]

def wa_call(path, payload):
    """POST to whichever WhatsApp gateway is configured. With Evolution the
    path already carries the instance, e.g. message/sendText/<instance>."""
    if WA_PROVIDER == "evolution":
        r = requests.post(f"{EVO_URL}/{path}",
                          headers={"apikey": EVO_KEY,
                                   "Content-Type": "application/json"},
                          json=payload, timeout=60)
    else:
        r = requests.post(f"{WHAPI}/{path}",
                          headers={"Authorization": f"Bearer {WHAPI_TOKEN}",
                                   "Accept": "application/json"},
                          json=payload, timeout=60)
    if not r.ok:
        raise RuntimeError(f"WA {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()

def wa_diagnose():
    """Config-error helper. Evolution: prints the instance connection state —
    it must be 'open'; anything else means the WhatsApp session dropped and
    needs re-linking (GET /instance/connect/<instance> returns a fresh QR).
    Whapi: dumps the channel list so the log shows the real channel IDs."""
    try:
        if WA_PROVIDER == "evolution":
            r = requests.get(f"{EVO_URL}/instance/connectionStatus/{EVO_INSTANCE}",
                             headers={"apikey": EVO_KEY}, timeout=30)
            if r.ok:
                state = (r.json() or {}).get("state")
                print(f"[wa]   instance {EVO_INSTANCE!r} state: {state} "
                      f"(needs 'open' — else re-scan the QR)")
            else:
                print(f"[wa]   instance status -> {r.status_code}: {r.text[:200]}")
            print(f"[wa]   channel target: {WA_CHANNEL}")
        else:
            r = requests.get(f"{WHAPI}/newsletters?count=100",
                             headers={"Authorization": f"Bearer {WHAPI_TOKEN}"}, timeout=30)
            if r.ok:
                chans = (r.json() or {}).get("newsletters") or []
                for c in chans[:10]:
                    print(f"[wa]   channel: {c.get('id')}  {str(c.get('name') or '')[:40]}")
                if not chans:
                    print("[wa]   gateway sees NO channels — the linked number is not "
                          "admin of any (create one, or fix the gateway number)")
            else:
                print(f"[wa]   channel list -> {r.status_code}: {r.text[:200]}")
                if r.status_code == 404:
                    print("[wa]   404 = Whapi token invalid, or the gateway number is "
                          "no longer paired to that channel (re-link it: Whapi dashboard "
                          "-> channel QR/admin settings)")
    except Exception as e:
        print(f"[wa]   channel list failed: {e}")

def send_whatsapp(p, snip_url=None):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    photo = snip_url or a.get("image_url")
    if WA_PROVIDER == "evolution":
        # Evolution API v2: sendText/sendMedia accept the channel JID
        # (xxx@newsletter) directly in `number`; media posts carry the caption.
        if photo:
            try:
                data = wa_call(f"message/sendMedia/{EVO_INSTANCE}",
                               {"number": WA_CHANNEL, "mediatype": "image",
                                "media": photo,
                                "caption": caption[:1024]})
                time.sleep(5)    # spacing — look human, not like a blast tool
                key = data.get("key") or {}
                return key.get("id") or data.get("id") or "sent"
            except RuntimeError as e:
                if CONFIG_ERR.search(str(e)):
                    raise          # gateway/instance broken -> text would fail too
                print(f"[wa] image failed ({e}) — sending as text")
        data = wa_call(f"message/sendText/{EVO_INSTANCE}",
                       {"number": WA_CHANNEL, "text": caption[:3500]})
        time.sleep(5)
        key = data.get("key") or {}
        return key.get("id") or data.get("id") or "sent"
    # ---- legacy Whapi.Cloud ----
    # /messages/image takes to + media + caption, /messages/text to + body.
    # Channel IDs look like 123456789@newsletter.
    if photo:
        try:
            data = wa_call("messages/image",
                           {"to": WA_CHANNEL, "media": photo,
                            "caption": caption[:1024]})
            time.sleep(5)            # spacing — look human, not like a blast tool
            return data.get("id") or "sent"
        except RuntimeError as e:
            if CONFIG_ERR.search(str(e)):
                raise               # channel broken -> the text post would fail too
            print(f"[wa] image failed ({e}) — sending as text")
    data = wa_call("messages/text",
                   {"to": WA_CHANNEL, "body": caption[:3500]})
    time.sleep(5)
    return data.get("id") or "sent"

SENDERS = {"telegram": send_telegram, "facebook": send_facebook, "whatsapp": send_whatsapp}

def main():
    for plat, ok in CONFIGURED.items():
        if not ok:
            print(f"[setup] {plat} not configured (missing secrets) — those articles stay website-only")
    tripped = set()   # platforms whose secrets look broken this run
    if CONFIGURED["facebook"] and fb_preflight():
        tripped.add("facebook")
    unrouted = articles_without_routing()
    if unrouted:
        route(unrouted)
    # ---- queue: NEWEST articles first; stale pendings are dropped ----
    # Rows left over from earlier runs (yesterday's backlog) must never jump
    # ahead of today's content: anything whose article is older than
    # PICKUP_WINDOW_H is expired (never posted), and the rest post newest-first.
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=PICKUP_WINDOW_H)).isoformat()
    fresh_ids = {r["id"] for r in
                 SB.table("articles").select("id")
                   .gte("created_at", cutoff).limit(500).execute().data}
    queue = (SB.table("social_posts").select("*, articles(*)")
             .in_("status", ["pending", "failed"]).lt("attempts", MAX_ATTEMPTS)
             .order("id", desc=True).limit(60).execute().data)
    live, stale = [], 0
    for p in queue:
        if (p.get("articles") or {}).get("id") not in fresh_ids:
            stale += 1
            SB.table("social_posts").update({"status": "expired"}).eq("id", p["id"]).execute()
        else:
            live.append(p)
    if stale:
        print(f"[queue] {stale} stale pending post(s) expired — articles older than {PICKUP_WINDOW_H}h, they will never post")
    live.sort(key=lambda p: (p.get("articles") or {}).get("created_at") or "",
              reverse=True)                                # newest article -> posted first
    # ---- absolute duplicate guard ------------------------------------------
    # Whatever routing did above, a pair that already went out in the last 48h
    # can never go out again. posted_at is written ONLY right after a successful
    # send and routing never touches it — so this check survives status
    # resets, stray duplicate rows and blind guard queries alike. This is the
    # line that makes channel duplicates structurally impossible.
    since48 = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    sent_recently = {(r["article_id"], r["platform"]) for r in
                     (SB.table("social_posts").select("article_id,platform")
                      .gte("posted_at", since48).execute().data)}
    pairs_seen, healed = set(), 0
    guarded = []
    for p in live:
        pair = (p["article_id"], p["platform"])
        if pair in pairs_seen:               # stray duplicate row for a pair queued this run
            SB.table("social_posts").update({"status": "skipped"}).eq("id", p["id"]).execute()
            healed += 1
            print(f"[guard] #{p['id']} ({p['platform']}) duplicate row for an already-queued pair — retired")
            continue
        if pair in sent_recently:            # pair already posted within 48h -> never again
            SB.table("social_posts").update({"status": "skipped"}).eq("id", p["id"]).execute()
            healed += 1
            print(f"[guard] #{p['id']} ({p['platform']}) already posted in the last 48h — stray row retired")
            continue
        pairs_seen.add(pair)
        guarded.append(p)
    if healed:
        print(f"[guard] {healed} stray/duplicate row(s) retired — no double posting")
    live = guarded
    failures = 0
    errors = []
    per_run = {}
    # ---- card snip session ----------------------------------------------
    # One browser for the whole run: first article pays the ~5s launch cost,
    # the rest reuse it. A hard deadline keeps snipping from ever stalling
    # the run past SNIP_DEADLINE_S — after that every article falls back to
    # its raw image and posting continues untouched.
    snip_ctx = None
    snip_pw = None
    snip_deadline = time.monotonic() + SNIP_DEADLINE_S
    if SNIP_ENABLED and live:
        try:
            snip_pw = sync_playwright().start()
            snip_ctx = snip_pw.chromium.launch(headless=True).new_context(
                viewport={"width": 1280, "height": 1600},
                device_scale_factor=2,      # 2x screenshot = crisp on phones
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/126 Safari/537.36")
        except Exception as e:
            print(f"[setup] browser unavailable ({str(e)[:100]}) — "
                  f"posts will use the raw article images")
            snip_ctx = None
    if snip_ctx:
        print(f"[setup] card snip active (bucket {SNIP_BUCKET!r}, "
              f"deadline {SNIP_DEADLINE_S}s, cache {SNIP_CACHE_H}h)")
    try:
      for p in live:
        plat = p["platform"]
        if plat in tripped:
            continue          # config error -> don't burn more attempts this run
        if per_run.get(plat, 0) >= RUN_CAPS.get(plat, 3):   # per-run throttle per platform
            continue                                       # stays pending for the next run
        per_run[plat] = per_run.get(plat, 0) + 1
        snip_url = None
        if snip_ctx and time.monotonic() < snip_deadline:
            snip_url = snip_card(p["articles"], snip_ctx)
        try:
            ext_id = SENDERS[p["platform"]](p, snip_url=snip_url)
            SB.table("social_posts").update({
                "status": "posted",
                "external_id": ext_id,
                "posted_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", p["id"]).execute()
            print(f"[post] #{p['id']} -> {p['platform']}: {p['articles']['title'][:60]}")
        except Exception as e:
            failures += 1
            errors.append(str(e)[:300])
            SB.table("social_posts").update({
                "status": "failed", "error": str(e)[:500],
                "attempts": (p["attempts"] or 0) + 1,
            }).eq("id", p["id"]).execute()
            print(f"[FAIL] #{p['id']} ({p['platform']}): {e}")
            if CONFIG_ERR.search(str(e)):
                tripped.add(plat)
                print(f"[setup] {plat} looks misconfigured — skipping its remaining posts this run; "
                      f"fix the secret and they retry automatically")
                if plat == "whatsapp":
                    wa_diagnose()          # Action log shows the real channel IDs
    finally:
      # browser down cleanly whether the loop finished, crashed or timed out
      if snip_ctx:
          try:
              snip_ctx.close()
          except Exception:
              pass
      if snip_pw:
          try:
              snip_pw.stop()
          except Exception:
              pass
    if failures and OWNER_ID and TG_TOKEN:
        try:                              # DM the owner the actual error text —
            tg_api("sendMessage", {   # 'failed' in the SQL stays explainable
                "chat_id": OWNER_ID,
                "text": f"\u26a0\ufe0f NewsShore: {failures} post(s) failed this run."
                        f"\n{errors[0][:250] if errors else ''}"})
        except Exception:
            pass                           # alerting must never crash the run
    sys.exit(1 if failures else 0)   # nonzero exit -> the alert step DMs you

if __name__ == "__main__":
    main()
