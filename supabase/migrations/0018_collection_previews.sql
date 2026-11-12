alter table public.collection_works
  add constraint collection_works_artwork_fk
  foreign key (artwork_id) references public.artworks(id) on delete cascade;
