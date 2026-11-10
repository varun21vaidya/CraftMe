// Group -> categories. Only the category is stored; the group is derived here. Keep in sync with supabase/migrations/0006_catalogue.sql.
export const GROUPS = {
  'Art': ['Paintings', 'Drawings', 'Digital Art', 'Photography', 'Art Prints'],
  'Handmade Crafts': ['Crochet & Knitting', 'Textiles & Embroidery', 'Wood Crafts', 'Metal Crafts', 'Pottery & Ceramics', 'Sculptures'],
  'Jewellery & Accessories': ['Handmade Jewellery', 'Bag & Phone Charms', 'Keychains'],
  'Festive & Home Decor': ['Ready Rangoli', 'Wall Hangings', 'Diyas & Candles', 'Gifts & Hampers'],
  'DIY Kits': ['Bead & Charm Kits', 'Jewellery Making Kits', 'Crochet & Embroidery Kits'],
};

export const CATEGORIES = Object.values(GROUPS).flat();
