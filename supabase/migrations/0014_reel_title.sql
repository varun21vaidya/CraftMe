-- An artist can name a reel ("Making of the blue vase"), so reels are easy to tell apart in lists and pickers.
alter table public.reels add column title text check (char_length(title) <= 80);
grant insert (title) on public.reels to authenticated;
grant update (title) on public.reels to authenticated;
