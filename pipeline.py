# pipeline.py sketch
existing = {r["source_url"] for r in supabase.table("articles").select("source_url").execute().data}
for item in feed.items:
    if item.link in existing:
        continue                      # already saved, skip
    article = rewrite(item)           # Gemini, falls back to GLM
    supabase.table("articles").upsert({"source_url": item.link, **article}).execute()
