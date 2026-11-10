-- Catalogue expansion: 22 categories in 5 groups (the group lives in src/lib/categories.js) and a new listing kind 'product'.
alter table public.artworks drop constraint artworks_category_check;

update public.artworks set category = case category
  when 'Painting'    then 'Paintings'
  when 'Drawing'     then 'Drawings'
  when 'Digital'     then 'Digital Art'
  when 'Print'       then 'Art Prints'
  when 'Textile'     then 'Textiles & Embroidery'
  when 'Woodwork'    then 'Wood Crafts'
  when 'Metalwork'   then 'Metal Crafts'
  when 'Sculpture'   then 'Sculptures'
  when 'Gifts'       then 'Gifts & Hampers'
  else category end;

alter table public.artworks add constraint artworks_category_check check (category in (
  'Paintings','Drawings','Digital Art','Photography','Art Prints',
  'Crochet & Knitting','Textiles & Embroidery','Wood Crafts','Metal Crafts','Pottery & Ceramics','Sculptures',
  'Handmade Jewellery','Bag & Phone Charms','Keychains',
  'Ready Rangoli','Wall Hangings','Diyas & Candles','Gifts & Hampers',
  'Bead & Charm Kits','Jewellery Making Kits','Crochet & Embroidery Kits'));

-- 'product' = a stocked ready-made item that is not a print. The "original is 0 or 1" check is untouched.
alter table public.listings drop constraint listings_kind_check;
alter table public.listings add constraint listings_kind_check check (kind in ('original','print','product'));
