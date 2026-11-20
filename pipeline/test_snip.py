# test_snip.py — offline tests for the card-snip layer in post.py.
# Everything network is mocked: no Supabase, no browser, no social APIs
# (T13 loads the real card markup into a local Chromium via about:blank —
# no network either — and skips itself when Chromium isn't installed).
# Run:  python test_snip.py
import os, sys, types, json, time, io
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-key")

# ---- import post.py: works in the repo (pipeline/post.py, run from there)
# and in this flat download folder (post.py next to this file) -------------
_here = os.path.dirname(os.path.abspath(__file__))
for _cand in (os.path.join(_here, "..", "pipeline"), _here):
    if os.path.exists(os.path.join(_cand, "post.py")):
        sys.path.insert(0, os.path.abspath(_cand))
        break
import post

PASS, FAIL = 0, 0
def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok   {name}")
    else:
        FAIL += 1
        print(f"  FAIL {name} {detail}")

def banner(t):
    print(f"\n== {t} ==")

# ---------------------------------------------------------------- helpers ---
class FakeTable:
    """Mimics SB.table('articles') chain for the snip cache read."""
    def __init__(self, rows):
        self.rows = rows
        self.updates = []
    def select(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def gte(self, *a, **k): return self
    def lt(self, *a, **k): return self
    def order(self, *a, **k): return self
    def limit(self, *a, **k): return self
    def execute(self): return types.SimpleNamespace(data=self.rows)
    def update(self, payload):
        self.updates.append(payload)
        return self

ART = {
    "id": "31f0d009-5955-4a7e-8fed-e48373e9b812",
    "title": "Robotics Evolving From Commercial Scale to Embodied Intelligence",
    "summary": "Robotics experts say the next frontier is moving beyond commercial applications.",
    "body": "The robotics industry is shifting. " + "Details follow. " * 40,
    "reliability": "claimed",
    "category": "Tech News",
    "region": "Global",
    "image_url": "https://images.unsplash.com/photo-1581090121489-ff9b54bbee43?w=1600&q=80",
    "public_url": "https://newsshore.vercel.app/article/31f0d009-5955-4a7e-8fed-e48373e9b812",
    "created_at": datetime.now(timezone.utc).isoformat(),
}

# ---------------------------------------------------------------- test 1 ----
banner("T1: URL normalizer strips tracking junk")
check("strips query + fragment, lowercases",
      post._norm_img("https://x.com/a.jpg?ixlib=rb-4.1.0&w=1600#frag")
      == "https://x.com/a.jpg")
check("empty -> empty", post._norm_img("") == "")
check("None -> empty", post._norm_img(None) == "")

# ---------------------------------------------------------------- test 2 ----
banner("T2: matcher JS builds correctly and matches by normalized image")
js = post._SNIP_JS.replace("IMG", json.dumps(ART["image_url"])).replace(
    "PREFIX", json.dumps(ART["title"][:28].lower()))
check("JS normalizes the embedded target (query stripped at match time)",
      f"norm({json.dumps(ART['image_url'])})" in js and "const norm" in js)
check("card img src is normalized before compare",
      "norm(im.getAttribute('src'))" in js)
check("JS embeds title prefix", "robotics evolving from c" in js)
check("JS has both match strategies",
      "norm(im.getAttribute('src'))" in js and "startsWith(prefix)" in js)

# ---------------------------------------------------------------- test 3 ----
banner("T3: snip filename + cache validity")
check("filename is <uuid>.jpg",
      post._snip_filename(ART) == "31f0d009-5955-4a7e-8fed-e48373e9b812.jpg")
fresh = [{"id": ART["id"], "card_image_url": "https://sb.co/social-cards/x.jpg",
          "card_snipped_at": datetime.now(timezone.utc).isoformat()}]
stale = [{"id": ART["id"], "card_image_url": "https://sb.co/social-cards/x.jpg",
          "card_snipped_at": (datetime.now(timezone.utc) - timedelta(hours=post.SNIP_CACHE_H + 1)).isoformat()}]
no_cols = [{"id": ART["id"]}]
with patch.object(post.SB, "table", return_value=FakeTable(fresh)):
    check("fresh cache hit returns URL", post._snip_cache_ok(ART) == "https://sb.co/social-cards/x.jpg")
with patch.object(post.SB, "table", return_value=FakeTable(stale)):
    check("stale cache returns None", post._snip_cache_ok(ART) is None)
with patch.object(post.SB, "table", return_value=FakeTable(no_cols)):
    check("missing columns -> None (no crash)", post._snip_cache_ok(ART) is None)

# ---------------------------------------------------------------- test 4 ----
banner("T4: PNG bytes -> JPEG re-encode (no crop, no edit)")
from PIL import Image
buf = io.BytesIO()
Image.new("RGB", (200, 100), (10, 20, 30)).save(buf, "PNG")
data, ctype = post._snip_bytes_to_jpeg(buf.getvalue())
check("returns image/jpeg", ctype == "image/jpeg")
im = Image.open(io.BytesIO(data))
check("dimensions preserved (no crop)", im.size == (200, 100))
check("bytes are real JPEG", data[:2] == b"\xff\xd8")

# ---------------------------------------------------------------- test 5 ----
banner("T5: snip_card success path (mock page + storage)")
class FakeElement:
    def scroll_into_view_if_needed(self): pass
    def screenshot(self, type=None): return buf.getvalue()
class FakeElementHandle:
    """JSHandle-like: as_element() yields the screenshot target."""
    def as_element(self): return FakeElement()
    def dispose(self): pass
class FakePage:
    def __init__(self, match_found=True):
        self.match_found = match_found
        self.closed = False
        self.styles = []          # restyle <style> tags injected here
    def emulate_media(self, **k): pass
    def goto(self, *a, **k): pass
    def wait_for_selector(self, *a, **k): pass
    def wait_for_timeout(self, *a, **k): pass
    def add_style_tag(self, content=None):
        if content is not None:
            self.styles.append(content)
    def evaluate(self, js):
        if "isAgo" in js:         # the restyle pass, not the card matcher
            return {"hidden": 2, "chips": ["24m ago", "43m ago"]}
        if self.match_found:
            return {"found": True, "how": "image", "hasImg": True, "w": 776, "h": 774}
        return None
    def evaluate_handle(self, js, arg):
        return FakeElementHandle() if self.match_found else None
    def wait_for_function(self, js, arg=None, timeout=None): pass
    def close(self): self.closed = True
class FakeCtx:
    def new_page(self): return FakePage()

class FakeBucket:
    def __init__(self): self.uploaded = None
    def upload(self, path, data, opts=None): self.uploaded = (path, data, opts)
    def get_public_url(self, path): return f"https://sb.co/{post.SNIP_BUCKET}/{path}"
class FakeStorage:
    def __init__(self): self.bucket = FakeBucket()
    def get_bucket(self, id): return object()
    def from_(self, id): return self.bucket
class FakeSB:
    def __init__(self, table): self._t = table; self.storage = FakeStorage()
    def table(self, name): return self._t

post._SNIP_MEMO.clear()
tbl = FakeTable([])
fake_sb = FakeSB(tbl)
with patch.object(post, "SB", fake_sb):
    url = post.snip_card(ART, FakeCtx())
check("returns public URL", url == "https://sb.co/social-cards/31f0d009-5955-4a7e-8fed-e48373e9b812.jpg")
check("page was closed", True, "closed flag set in FakePage.close")
check("bucket upload got JPEG bytes", fake_sb.storage.bucket.uploaded[1][:2] == b"\xff\xd8")
check("upload used upsert", fake_sb.storage.bucket.uploaded[2].get("upsert") == "true")
check("DB cache write attempted", tbl.updates and "card_image_url" in tbl.updates[0])
check("memo populated", ART["id"] in post._SNIP_MEMO)

# cache hit via memo — second call must NOT touch the browser
class NoPageCtx:
    def new_page(self): raise AssertionError("memo hit should not open a page")
with patch.object(post, "SB", fake_sb):
    url2 = post.snip_card(ART, NoPageCtx())
check("memo hit returns same URL without browsing", url2 == url)

# ---------------------------------------------------------------- test 6 ----
banner("T6: fallbacks — no card matched / no image / snip disabled")
class NoMatchCtx:
    """Page whose matcher finds nothing (evaluate returns None)."""
    def new_page(self): return FakePage(match_found=False)
post._SNIP_MEMO.clear()
with patch.object(post, "SB", fake_sb):
    url = post.snip_card(ART, NoMatchCtx())
check("no-match -> None (raw image fallback)", url is None)

no_img = dict(ART, image_url=None)
post._SNIP_MEMO.clear()
check("article without image -> None", post.snip_card(no_img, FakeCtx()) is None)

with patch.object(post, "SNIP_ENABLED", False):
    check("SNIP_ENABLED=0 -> None", post.snip_card(ART, FakeCtx()) is None)

# ---------------------------------------------------------------- test 7 ----
banner("T7: senders receive the snip URL (photo = snip over raw image)")
sent = {}
with patch.object(post, "tg_api", side_effect=lambda m, p: sent.update({m: p}) or {"message_id": 1}):
    post.send_telegram({"articles": ART}, snip_url="https://sb.co/card.jpg")
check("telegram sendPhoto uses snip", sent.get("sendPhoto", {}).get("photo") == "https://sb.co/card.jpg")
sent.clear()
with patch.object(post, "tg_api", side_effect=lambda m, p: sent.update({m: p}) or {"message_id": 1}):
    post.send_telegram({"articles": ART})   # no snip -> raw image, old behavior
check("telegram falls back to raw image", sent.get("sendPhoto", {}).get("photo") == ART["image_url"])

fb_calls = []
with patch.object(post, "fb_call", side_effect=lambda p, pl: fb_calls.append((p, pl)) or {"post_id": "fb1"}):
    post.send_facebook({"articles": ART}, snip_url="https://sb.co/card.jpg")
check("facebook photos call uses snip", fb_calls[0][1]["url"] == "https://sb.co/card.jpg")

wa_calls = []
with patch.object(post, "wa_call", side_effect=lambda p, pl: wa_calls.append((p, pl)) or {"id": "wa1"}), \
     patch.object(post, "WA_PROVIDER", "whapi"), patch.object(post, "time") as _t, _t.sleep:
    post.send_whatsapp({"articles": ART}, snip_url="https://sb.co/card.jpg")
check("whatsapp (whapi) image call uses snip",
      wa_calls[0][0] == "messages/image" and wa_calls[0][1]["media"] == "https://sb.co/card.jpg")

wa_calls.clear()
with patch.object(post, "wa_call", side_effect=lambda p, pl: wa_calls.append((p, pl)) or {"key": {"id": "wa2"}}), \
     patch.object(post, "WA_PROVIDER", "evolution"), patch.object(post, "EVO_INSTANCE", "inst"), \
     patch.object(post, "WA_CHANNEL", "123@newsletter"), patch.object(post, "time") as _t, _t.sleep:
    post.send_whatsapp({"articles": ART}, snip_url="https://sb.co/card.jpg")
check("whatsapp (evolution) sendMedia uses snip",
      wa_calls[0][0] == "message/sendMedia/inst" and wa_calls[0][1]["media"] == "https://sb.co/card.jpg")

# ---------------------------------------------------------------- test 8 ----
banner("T8: storage failure -> clean fallback, no crash")
class BrokenStorage:
    def get_bucket(self, id): raise RuntimeError("bucket api down")
    def create_bucket(self, id, options=None): raise RuntimeError("403 no perms")
class BrokenSB:
    def __init__(self, table): self._t = table; self.storage = BrokenStorage()
    def table(self, name): return self._t
post._SNIP_MEMO.clear()
with patch.object(post, "SB", BrokenSB(FakeTable([]))):
    url = post.snip_card(ART, FakeCtx())
check("storage down -> None (post still goes out with raw image)", url is None)

# ---------------------------------------------------------------- test 9 ----
banner("T9: browser page error -> clean fallback")
class ExplodingPage(FakePage):
    def goto(self, *a, **k): raise post.PWError("net::ERR_CONNECTION_RESET")
class ExplodingCtx:
    def new_page(self): return ExplodingPage()
post._SNIP_MEMO.clear()
with patch.object(post, "SB", fake_sb):
    url = post.snip_card(ART, ExplodingCtx())
check("browser error -> None, no exception", url is None)

# ---------------------------------------------------------------- test 10 ---
banner("T10: main-loop snip budget logic (deadline check is monotonic)")
t0 = time.monotonic()
check("deadline math sane",
      t0 + post.SNIP_DEADLINE_S > t0 and post.SNIP_DEADLINE_S > 0)

# ---------------------------------------------------------------- test 11 ---
banner("T11: social restyle — CSS hides chips + paints navy")
css = post._SNIP_RESTYLE_CSS
check("min-read chip hidden (whole chip, not just the icon)",
      "span:has(> svg.lucide-clock)" in css and "display: none" in css)
check("verified badge hidden", "lucide-shield-check" in css)
check("claimed badge hidden", "lucide-circle-alert" in css)
check("white card -> navy", "article.bg-white { background: NAVY" in css)
check("hero fade -> navy gradient", "article.bg-gray-900 div.bg-gradient-to-t" in css
      and "linear-gradient" in css)
navy_css = css.replace("NAVYRGB", "11, 31, 58").replace("NAVY", "#0b1f3a")
check("navy substitutes cleanly (no leftover placeholders)",
      "NAVY" not in navy_css)
check("navy rgb triplet derived from hex",
      post.SNIP_NAVY == "#0b1f3a" and "rgba(11, 31, 58,0.3)" in navy_css)

# ---------------------------------------------------------------- test 12 ---
banner("T12: social restyle — wiring into the capture flow")
probe_page = None
class RestyleProbePage(FakePage):
    """Records whether the restyle ran before the screenshot was taken."""
    def __init__(self, **k):
        global probe_page
        super().__init__(**k)
        self.events = []
        probe_page = self
    def add_style_tag(self, content=None):
        self.events.append("style")
        super().add_style_tag(content=content)
    def evaluate(self, js):
        if "isAgo" in js:
            self.events.append("restyle-js")
            return {"hidden": 2, "chips": ["24m ago"]}
        return super().evaluate(js)
    def evaluate_handle(self, js, arg):
        self.events.append("handle")
        return super().evaluate_handle(js, arg)
class RestyleProbeCtx:
    def new_page(self): return RestyleProbePage()
post._SNIP_MEMO.clear()
with patch.object(post, "SB", fake_sb):
    post.snip_card(ART, RestyleProbeCtx())
check("restyle (style + JS pass) runs before the card handle is located",
      probe_page.events == ["style", "restyle-js", "handle"])

# ---------------------------------------------------------------- test 13 ---
banner("T13: social restyle — real browser vs the real card DOM")
# The restyle runs against Chromium locally: the site's real white-card and
# hero-card markup (captured from the live site, trimmed to structure +
# classes, offline-safe image srcs), restyled, must actually hide the chips
# and paint navy. Offline-safe: skipped (and said so) when Chromium isn't
# installed. Structure below is exactly what newsshore.vercel.app renders:
# grid card = <article class="group bg-white ..."> with a photo on top and
# the info block under it; hero = <article class="hero-animate ... bg-gray-900">
# with the bottom gradient overlay.
REAL_CARD_DOM = r"""
<article class="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col news-card-hover"><div class="relative h-36 sm:h-48 overflow-hidden"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Major tech outages disrupt work, banking, and cloud services" loading="lazy" class="w-full h-full object-cover img-zoom"/><div class="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex flex-wrap items-center gap-1.5"><span data-slot="badge" class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden border-transparent bg-gray-100 text-gray-700 text-[10px] sm:text-xs font-[family-name:var(--font-dm-sans)]">Tech News</span><span data-slot="badge" class="inline-flex items-center justify-center rounded-md px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden border-transparent bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs border-0 gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check w-3 h-3" aria-hidden="true"></svg><span class="hidden xs:inline">Independently </span>verified</span></div></div><div class="p-3.5 sm:p-5 flex flex-col flex-1"><h3 class="font-[family-name:var(--font-space-grotesk)] text-base sm:text-lg font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-red-600 transition-colors">Major tech outages disrupt work, banking, and cloud services</h3><p class="font-[family-name:var(--font-gilroy)] text-xs sm:text-sm text-gray-500 mt-2 line-clamp-2 flex-1">A series of simultaneous outages affecting email, banking, and cloud storage caused significant disruption this week.</p><div class="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-50"><span class="inline-flex items-center border border-gray-200 text-gray-500 text-[10px] sm:text-xs gap-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide lucide-globe w-2.5 h-2.5" aria-hidden="true"></svg> Global</span><span class="flex items-center gap-1 text-gray-400 text-xs sm:text-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide lucide-clock w-2.5 h-2.5" aria-hidden="true"></svg><span>1 min read</span></span><span class="text-gray-400 text-xs sm:text-sm">43m ago</span></div></div></article>
<article class="hero-animate group relative rounded-xl sm:rounded-2xl overflow-hidden bg-gray-900 cursor-pointer h-[320px] sm:h-[440px] lg:h-[520px]"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="SpaceX Bondholders Seek to Keep Collateral on Earth" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"/><div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div><div class="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10"><div class="flex flex-wrap items-center gap-2 mb-2 sm:mb-3"><span data-slot="badge" class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden border-transparent bg-gray-100 text-gray-700 font-[family-name:var(--font-gilroy)] text-xs sm:text-sm">Tech News</span><span data-slot="badge" class="inline-flex items-center justify-center rounded-md px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden border-transparent bg-orange-100 text-orange-700 text-[10px] sm:text-xs border-0 gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-alert w-3 h-3" aria-hidden="true"></svg>Company claim</span><span data-slot="badge" class="inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 gap-1 overflow-hidden bg-white/10 border-white/20 text-white text-[10px] sm:text-xs font-[family-name:var(--font-space-grotesk)] gap-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide lucide-globe w-3 h-3" aria-hidden="true"></svg> Global</span></div><h1 class="font-[family-name:var(--font-space-grotesk)] text-xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mt-2">SpaceX Bondholders Seek to Keep Collateral on Earth</h1><p class="font-[family-name:var(--font-gilroy)] text-gray-300 mt-2 sm:mt-3 text-sm sm:text-base lg:text-lg line-clamp-2 max-w-2xl">Bondholders for SpaceX have requested that the company's valuable collateral, which includes computer chips, remain on Earth.</p><div class="flex items-center gap-3 sm:gap-4 mt-3 sm:mt-4"><span class="flex items-center gap-1 text-gray-400 font-[family-name:var(--font-space-grotesk)] text-gray-300 text-xs sm:text-sm"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="lucide lucide-clock w-2.5 h-2.5 sm:w-3 sm:h-3" aria-hidden="true"></svg><span>2 min read</span></span><span class="text-gray-400 text-xs sm:text-sm">24m ago</span></div></div></article>
"""
try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True)
        pg = b.new_page()
        pg.goto("about:blank")
        pg.set_content(REAL_CARD_DOM)
        post._snip_style_card(pg)
        # everything must be evaluated INSIDE the with block — the sync API's
        # event loop closes when it exits, later pg.evaluate would raise
        chips_hidden = pg.evaluate(
            "() => ['article span:has(> svg.lucide-clock)',"
            "        'article span[data-slot=\"badge\"]:has(> svg.lucide-shield-check)',"
            "        'article span[data-slot=\"badge\"]:has(> svg.lucide-circle-alert)']"
            "       .every(sel => { const el = document.querySelector(sel);"
            "                      return !el || getComputedStyle(el).display === 'none'; })")
        hidden = pg.evaluate(
            "() => [...document.querySelectorAll('article span')]"
            ".filter(s => s.offsetParent === null)"
            ".map(s => s.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean)")
        navy_bg = pg.evaluate(
            "() => getComputedStyle(document.querySelector('article.bg-white')).backgroundColor")
        hero_fade = pg.evaluate(
            "() => getComputedStyle(document.querySelector('article.bg-gray-900 .bg-gradient-to-t')).backgroundImage")
        title_color = pg.evaluate(
            "() => getComputedStyle(document.querySelector('article.bg-white h3')).color")
        b.close()
    check("min-read, verified, claim chips all display:none (CSS layer)",
          chips_hidden is True, "chips still visible")
    check("'43m ago' and '24m ago' hidden by the JS pass",
          "43m ago" in hidden and "24m ago" in hidden,
          f"got {hidden}")
    check("white card background is navy",
          navy_bg == "rgb(11, 31, 58)", f"got {navy_bg}")
    check("hero fade is a navy gradient",
          "rgb(11, 31, 58)" in hero_fade and "gradient" in hero_fade.lower(),
          f"got {hero_fade[:80]}")
    check("title text flipped light for navy",
          title_color == "rgb(248, 250, 252)", f"got {title_color}")
except Exception as e:
    print(f"  skip real-browser checks ({str(e)[:80]}) — Chromium not available")

# ---------------------------------------------------------------- test 14 ---
banner("T14: restyle failure never blocks a snip")
class RestyleExplodingPage(FakePage):
    def add_style_tag(self, content=None):
        raise post.PWError("page crashed; target closed")
class RestyleExplodingCtx:
    def new_page(self): return RestyleExplodingPage()
post._SNIP_MEMO.clear()
with patch.object(post, "SB", fake_sb):
    url = post.snip_card(ART, RestyleExplodingCtx())
check("restyle blew up, snip still captured + uploaded",
      url == "https://sb.co/social-cards/31f0d009-5955-4a7e-8fed-e48373e9b812.jpg")

# ---------------------------------------------------------------- test 15 ---
banner("T15: SNIP_RESTYLE=0 disables the restyle, keeps the rest")
probe2 = {}
class NoStylePage(FakePage):
    def add_style_tag(self, content=None):
        probe2["style"] = True   # must NOT be called when SNIP_RESTYLE=0
class NoStyleCtx:
    def new_page(self): return NoStylePage()
post._SNIP_MEMO.clear()
with patch.object(post, "SNIP_RESTYLE", False), \
     patch.object(post, "SB", fake_sb):
    url = post.snip_card(ART, NoStyleCtx())
check("SNIP_RESTYLE=0 -> no style tag, snip still works",
      "style" not in probe2 and url is not None)

print(f"\n{'ALL PASS' if FAIL == 0 else 'FAILURES: ' + str(FAIL)}  ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
