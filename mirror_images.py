# mirror_images.py — copies article images into the Supabase bucket.
# Idempotent: already-mirrored articles are skipped instantly, so it is safe
# (and cheap) to run on every pipeline run. The first runs drain old articles;
# after that it only mirrors what the JS pipeline just saved.
import os
from supabase import create_client
from imaging import mirror_image

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
MARK = "/storage/v1/object/public/"     # the fingerprint of a bucket URL
BATCH = 30                              # per run — backlog drains over a few runs

rows = SB.table("articles").select("id,image_url") \
    .not_.is_("image_url", "null") \
    .order("created_at", desc=True).limit(300).execute().data

todo = [r for r in rows if MARK not in (r["image_url"] or "")]
for r in todo[:BATCH]:
    new = mirror_image(r["id"], r["image_url"])
    if new and MARK in new:
        SB.table("articles").update(
            {"image_url": new, "source_image_url": r["image_url"]}) \
            .eq("id", r["id"]).execute()
        print("[mirror]", r["id"])
print(f"[mirror] {min(len(todo), BATCH)} mirrored, {max(0, len(todo) - BATCH)} still queued")
