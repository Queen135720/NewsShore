-- card-snip cache columns (OPTIONAL but recommended)
-- post.py 2.x stores each article's snipped card URL + timestamp so a
-- multi-platform article is captured once and re-used while fresh. The
-- columns are strictly optional: without them the per-run in-memory memo
-- still keeps one article to one capture per run; with them, snips also
-- survive across runs while the article is fresh enough to post.
--
-- Run once in Supabase Dashboard -> SQL Editor:
alter table articles
  add column if not exists card_image_url text,
  add column if not exists card_snipped_at timestamptz;

-- The bucket is created automatically (public) on first use if the service
-- key has storage permissions; to create it manually instead:
-- insert into storage.buckets (id, name, public)
--   values ('social-cards', 'social-cards', true)
--   on conflict (id) do nothing;
