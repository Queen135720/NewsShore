# backfill_article_images.py — run ONCE locally after creating the bucket
# export SUPABASE_URL=... && export SUPABASE_SERVICE_KEY=... && python backfill_article_images.py
import os
from supabase import create_client
from imaging import mirror_image

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
MARK = "/storage/v1/object/public/"
rows = SB.table("articles").select("id,image_url").not_.is_("image_url", "null") \
    .order("created_at", desc=True).limit(500).execute().data
for r in rows:
    if MARK in (r["image_url"] or ""):
        continue                                    # already mirrored
    new = mirror_image(r["id"], r["image_url"])
    if new and MARK in new:
        SB.table("articles").update({"image_url": new, "source_image_url": r["image_url"]}) \
            .eq("id", r["id"]).execute()
        print("[article-images] mirrored", r["id"])
print("[article-images] done")
