import os
from datetime import datetime, timezone, timedelta
from supabase import create_client

SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
BUCKET = "article-images"
cutoff = datetime.now(timezone.utc) - timedelta(days=90)
prefixes = sorted({(datetime.now(timezone.utc) - timedelta(days=30 * i)).strftime("%Y/%m")
                   for i in range(1, 5)})
for prefix in prefixes:
    y, m = map(int, prefix.split("/"))
    month_end = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1,
                         tzinfo=timezone.utc) - timedelta(seconds=1)
    if month_end >= cutoff:
        continue
    items = [i for i in SB.storage.from_(BUCKET).list(prefix) if i.get("id")]
    names = [f"{prefix}/{i['name']}" for i in items]
    if names:
        SB.storage.from_(BUCKET).remove(names)
        print(f"removed {len(names)} images from {prefix}")
