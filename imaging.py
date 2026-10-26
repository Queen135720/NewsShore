import io, os
from datetime import datetime, timezone
import requests
from PIL import Image

BUCKET, MAX_EDGE, JPEG_Q = "article-images", 1200, 82
UA = {"User-Agent": "Mozilla/5.0 (compatible; NewsShoreBot/1.0)"}

from imaging import mirror_image
# when building the row you insert:
row = {
    ...,
    "source_image_url": raw_image_url,                    # what RSS gave you
    "image_url": mirror_image(a["id"], raw_image_url),    # canonical bucket URL
}

def mirror_image(article_id, src_url):
    """Download source image -> resize -> Supabase Storage -> public URL.
    Returns src_url unchanged on any failure (callers fall back gracefully)."""
    if not src_url:
        return None
    try:
        r = requests.get(src_url, headers=UA, timeout=30)
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
        img.thumbnail((MAX_EDGE, MAX_EDGE))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=JPEG_Q)
        path = f"{datetime.now(timezone.utc):%Y/%m}/{article_id}.jpg"   # date prefix = easy cleanup
        up = requests.post(
            f"{os.environ['SUPABASE_URL']}/storage/v1/object/{BUCKET}/{path}",
            headers={"Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_KEY']}",
                     "Content-Type": "image/jpeg", "x-upsert": "true"},
            data=buf.getvalue(), timeout=60)
        up.raise_for_status()
        return f"{os.environ['SUPABASE_URL']}/storage/v1/object/public/{BUCKET}/{path}"
    except Exception as e:
        print(f"[imaging] mirror failed {article_id}: {e}")
        return src_url
      
def extract_image(entry):
    for enc in entry.get("enclosures", []) or []:
        if enc.get("type", "").startswith("image/"):
            return enc.get("href")
    for mc in entry.get("media_content", []) or []:
        if mc.get("medium") == "image" or mc.get("type", "").startswith("image/"):
            return mc.get("url")
    thumbs = entry.get("media_thumbnail") or []
    return thumbs[0].get("url") if thumbs else None
