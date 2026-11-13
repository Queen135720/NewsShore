# post.py — NewsShore social distributor. ZERO AI calls.
# fetch-and-publish.js owns fetch/rewrite/save. This script only:
#   1. picks the PLATFORM LIST for each article (category rules + daily caps)
#      -> one social_posts row per (article, platform): a big story can hit
#         telegram + facebook + whatsapp at once
#   2. cleans it into a human-looking post (markdown stripped, pure regex)
#   3. posts it: sentence-case headline + ~70% of the article body + image + link
#   4. HARD duplicate guard: a (article, platform) pair that already went out
#      in the last 48h can never be sent again, no matter what routing did
# Only articles saved within PICKUP_WINDOW_H hours are ever routed (latest
# content only — no old backlog drains).

import os, sys, time
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
SITE       = os.environ.get("SITE_URL", "https://newsshore.com")

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

DAILY_CAPS   = {"whatsapp": 10, "facebook": 20, "telegram": 40}
MAX_ATTEMPTS = 3
PICKUP_WINDOW_H = 2     # only articles saved within this many hours get posted
RUN_CAPS     = {"telegram": 6, "facebook": 4, "whatsapp": 3}   # max posts per platform per run

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

# ---------- sentence-case headlines ------------------------------------------
# Words allowed to go lowercase inside a headline. Anything NOT in this list
# keeps its own casing, so proper nouns, acronyms and product names
# (Uber, ElevenLabs, XR, GPS, Pixel Watch, llama.cpp) survive untouched:
#   "Uber Data Breach Exposes Driver Licenses"  -> "Uber data breach exposes driver licenses"
#   "Pixel Watch Gets Media Controls Redesign"  -> "Pixel Watch gets media controls redesign"
# Caps stay reserved for genuine names/acronyms — never the whole headline.
COMMON = frozenset("""
a an the and or but nor yet so of to in on at by for with from as into onto
about over under after before between among across against amid during since
until via per up down out off than then some any all both each other another
such own same too very just now here there when where why how what which who
whom whose while whether if because although though instead also more most
less least few many much every either neither again once not no its his her
their our your my this that these those is are was were be been being has
have had do does did says said say gets get got goes go makes make made takes
take took comes come came sees see saw seen uses use used calls call called
launches launch launched unveils unveiled releases release released
announces announce announced reveals reveal revealed shows show shown brings
brought adds added plans plan eyes set sets wins won beats hit hits run runs
opens open opened tops leads lead led sparks drops dropped cuts joins joined
builds built ships shipped rolls new old big small first second third last
next early late full free high low top end start week year day days month
time users user people world global local online data app apps web home tech
digital future report reports check checks faulty cause caused server servers
system systems access grant grants driver licenses exposes gift guide dads
dad mom moms parents meeting notes dictation agent agents balances
personality lets shop wallet fresh media controls redesign collection smart
devices boost incentives spectrum regulator experience shine glasses
subscription based cross platform
through you breach breaches navigation screenless device outage outages
""".split())

def sentence_case(t):
    """Headline casing: keep the first word as written, lowercase only
    COMMON words, and preserve acronyms (AI, XR), digit tokens (v1.0.0, 2026)
    and anything that already looks like a name/product (ElevenLabs, llama.cpp)."""
    if not t:
        return t
    if t.isupper() and len(t) > 15:           # whole-title shoutcase -> soften
        t = t.title()
    out = []
    for i, w in enumerate(t.split(" ")):
        core = w.strip("()[]{}<>\"'“”‘’.,;:!?—–-")
        keep = (i == 0                                # first word: as written
                or not core                           # bare punctuation
                or (core.isupper() and len(core) > 1)  # acronym: AI, XR, GPS
                or any(c.isdigit() for c in core)      # 2026, v1.0.0
                or w[0].islower()                     # already lowercase
                or core.lower() not in COMMON)        # name/product/brand
        out.append(w if keep else w.lower())
    return " ".join(out)

BODY_SHARE    = 0.70   # share of the article body that goes into a social post
BODY_HARD_CAP = 4500   # ceiling sized so the FB photo-caption slice keeps the link line

def build_caption(a, url):
    title = sentence_case(re.sub(r"\s+", " ",
                      strip_md(clean_chars(a.get("title") or ""))).strip())
    # The BODY is the post text — the summary is only a last-resort fallback.
    body = humanize((a.get("body") or "").strip())
    if len(body) < 60:
        body = humanize((a.get("summary") or "").strip())
    if len(body) < 60:
        body = "Full story on the site."
    body = body[:1].upper() + body[1:]
    # ~70% of the body, always ending on a full sentence, never mid-word.
    body = clip_sentences(body, min(BODY_HARD_CAP, max(200, int(len(body) * BODY_SHARE))))
    return f"{title}\n\n{body}\n\nGet the full article 👉 {url}"

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
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    return (SB.table("social_posts").select("id", count="exact")
             .eq("platform", platform).in_("status", ["pending", "posted", "ready"])
             .gte("created_at", start).execute().count)

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
                continue                    # daily cap hit -> retried within the window
            counts[plat] += 1
            write_row({"article_id": a["id"], "platform": plat,
                       "status": "pending"})
            existing.add((a["id"], plat))
            queued += 1
            made = True
        on_now = [p for p in platforms if (a["id"], p) in existing]
        missing = [p for p in platforms if p not in on_now]
        extra = f"  (waiting: {', '.join(missing)})" if missing else ""
        print(f"[route] {a['title'][:55]} -> {', '.join(on_now) or 'none'}{extra}")
        if made:
            routed += 1
            seen.append((a["id"], tw))
    print(f"[route] {routed} article(s) routed -> {queued} post(s) queued, "
          f"{waiting} platform slot(s) waiting, {dups} duplicate(s) skipped")

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
            if CONFIG_ERR.search(str(e)):
                raise               # token dead -> the link post would fail too
            print(f"[fb] photo failed ({e}); image was {a['image_url']}")
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
    except Exception as e:
        print(f"[wa]   channel list failed: {e}")

def send_whatsapp(p):
    a = p["articles"]
    caption = build_caption(a, article_url(a))
    if WA_PROVIDER == "evolution":
        # Evolution API v2: sendText/sendMedia accept the channel JID
        # (xxx@newsletter) directly in `number`; media posts carry the caption.
        if a.get("image_url"):
            try:
                data = wa_call(f"message/sendMedia/{EVO_INSTANCE}",
                               {"number": WA_CHANNEL, "mediatype": "image",
                                "media": a["image_url"],
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
    if a.get("image_url"):
        try:
            data = wa_call("messages/image",
                           {"to": WA_CHANNEL, "media": a["image_url"],
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
    tripped = set()   # platforms whose secrets look broken this run
    for p in live:
        plat = p["platform"]
        if plat in tripped:
            continue          # config error -> don't burn more attempts this run
        if per_run.get(plat, 0) >= RUN_CAPS.get(plat, 3):   # per-run throttle per platform
            continue                                       # stays pending for the next run
        per_run[plat] = per_run.get(plat, 0) + 1
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
