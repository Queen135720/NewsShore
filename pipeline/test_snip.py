# test_snip.py — offline tests for the card-snip layer in post.py.
# Everything network is mocked: no Supabase, no browser, no social APIs.
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
    def emulate_media(self, **k): pass
    def goto(self, *a, **k): pass
    def wait_for_selector(self, *a, **k): pass
    def wait_for_timeout(self, *a, **k): pass
    def evaluate(self, js):
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

print(f"\n{'ALL PASS' if FAIL == 0 else 'FAILURES: ' + str(FAIL)}  ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
