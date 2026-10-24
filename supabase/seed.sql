-- Khang — seed data
--
-- The menu the site ships with: 5 categories, 17 dishes, and the four
-- house reviews shown on the home page. Safe to re-run — every insert is
-- keyed on its natural key.

-- ── categories ──────────────────────────────────────────────────────────

insert into public.categories (name, slug, icon, sort_order) values
  ('Dim Sum', 'dim-sum', '🥟', 1),
  ('Noodles & Soups', 'noodles-soups', '🍜', 2),
  ('Rice & Curry', 'rice-curry', '🍛', 3),
  ('Snacks', 'snacks', '🍟', 4),
  ('Drinks', 'drinks', '🥤', 5)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

-- ── the menu ────────────────────────────────────────────────────────────

insert into public.products (
  slug, name, chinese_name, category, price, description, ingredients,
  image, rating, reviews_count, spicy, veg, featured, prep_time, in_stock
) values
  ('khang-special-veg-momo', 'Khang Special Veg Momo', '康式素饺', 'Dim Sum', 180, 'Hand-folded steamed dumplings stuffed with cabbage, carrot, bell pepper and a hint of ginger-garlic. Served with our signature schezwan dip.', array['Refined flour', 'Cabbage', 'Carrot', 'Spring onion', 'Ginger', 'Garlic', 'Sesame oil']::text[], 'https://images.pexels.com/photos/35144940/pexels-photo-35144940.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.8, 412, 1, true, true, '15 min', true),
  ('chicken-dimsum-basket', 'Chicken Dimsum Basket', '鸡肉点心', 'Dim Sum', 240, 'Delicate translucent wrappers cradling minced chicken seasoned with soy, sesame, and a touch of white pepper. Steamed in bamboo baskets.', array['Chicken mince', 'Wheat starch', 'Soy', 'Sesame', 'Coriander', 'White pepper']::text[], 'https://images.pexels.com/photos/32393812/pexels-photo-32393812.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.9, 587, 1, false, true, '18 min', true),
  ('pan-fried-chicken-momo', 'Pan-Fried Chicken Momo', '煎鸡饺', 'Dim Sum', 260, 'Steamed first, then pan-seared to golden perfection. Crisp base, juicy chicken filling, served with chilli-garlic oil.', array['Chicken', 'Garlic', 'Soy', 'Chilli oil', 'Spring onion']::text[], 'https://images.pexels.com/photos/14457519/pexels-photo-14457519.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 318, 2, false, true, '20 min', true),
  ('crystal-prawn-hargao', 'Crystal Prawn Hargao', '虾饺', 'Dim Sum', 320, 'Cantonese classic — succulent prawn wrapped in glass-thin wheat starch skins. Each piece pleated by hand.', array['Prawn', 'Bamboo shoot', 'Wheat starch', 'Tapioca', 'Sesame oil']::text[], 'https://images.pexels.com/photos/27039841/pexels-photo-27039841.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.9, 246, 0, false, true, '22 min', true),
  ('hakka-chow-mein', 'Hakka Chow Mein', '客家炒面', 'Noodles & Soups', 220, 'Smoky wok-tossed noodles with crunchy julienned vegetables in a savoury soy & sesame glaze. The wok-hei is real.', array['Hakka noodles', 'Cabbage', 'Capsicum', 'Carrot', 'Soy', 'Sesame']::text[], 'https://images.pexels.com/photos/14853728/pexels-photo-14853728.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 521, 1, true, true, '12 min', true),
  ('schezwan-chicken-noodles', 'Schezwan Chicken Noodles', '川味鸡肉面', 'Noodles & Soups', 280, 'Fiery Schezwan-style noodles tossed with shredded chicken, bell peppers and our house chilli-bean paste.', array['Noodles', 'Chicken', 'Schezwan sauce', 'Capsicum', 'Garlic']::text[], 'https://images.pexels.com/photos/12737657/pexels-photo-12737657.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 389, 3, false, false, '14 min', true),
  ('hot-sour-soup', 'Hot & Sour Soup', '酸辣汤', 'Noodles & Soups', 160, 'The original — black pepper, vinegar, mushrooms, tofu and silken egg ribbons in a velvety broth.', array['Vegetable stock', 'Tofu', 'Mushroom', 'Egg', 'Vinegar', 'Pepper']::text[], 'https://images.pexels.com/photos/18698263/pexels-photo-18698263.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.5, 284, 2, true, false, '10 min', true),
  ('sweet-corn-chicken-soup', 'Sweet Corn Chicken Soup', '玉米鸡汤', 'Noodles & Soups', 170, 'Comfort in a bowl — silky corn soup with shredded chicken and a swirl of egg.', array['Sweet corn', 'Chicken', 'Egg', 'Cornflour', 'Pepper']::text[], 'https://images.pexels.com/photos/10966377/pexels-photo-10966377.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.4, 192, 0, false, false, '10 min', true),
  ('veg-triple-schezwan-rice', 'Veg Triple Schezwan Rice', '三重川味饭', 'Rice & Curry', 260, 'Layered tower of fried rice, hakka noodles and Schezwan gravy crowned with crispy veggies. A meal in itself.', array['Basmati rice', 'Noodles', 'Schezwan gravy', 'Mixed veg']::text[], 'https://images.pexels.com/photos/24334865/pexels-photo-24334865.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 433, 2, true, true, '16 min', true),
  ('chicken-fried-rice', 'Chicken Fried Rice', '鸡肉炒饭', 'Rice & Curry', 240, 'Long-grain rice tossed with chicken, egg, spring onion and a kiss of dark soy. Simple, smoky, perfect.', array['Basmati rice', 'Chicken', 'Egg', 'Spring onion', 'Soy']::text[], 'https://images.pexels.com/photos/343871/pexels-photo-343871.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 367, 1, false, false, '12 min', true),
  ('chilli-chicken-gravy', 'Chilli Chicken Gravy', '辣子鸡', 'Rice & Curry', 290, 'Crispy chicken bites in a glossy, fiery sauce of green chilli, garlic and soy. Best with steamed rice.', array['Chicken', 'Green chilli', 'Garlic', 'Soy', 'Vinegar', 'Capsicum']::text[], 'https://images.pexels.com/photos/29631426/pexels-photo-29631426.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.8, 511, 3, false, true, '15 min', true),
  ('veg-manchurian-dry', 'Veg Manchurian Dry', '素满洲', 'Rice & Curry', 220, 'Golden-fried vegetable balls tossed in a tangy Indo-Chinese sauce with ginger, garlic and spring onion.', array['Mixed vegetables', 'Cornflour', 'Soy', 'Ginger', 'Garlic']::text[], 'https://images.pexels.com/photos/28674543/pexels-photo-28674543.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 298, 2, true, false, '14 min', true),
  ('crispy-veg-spring-rolls', 'Crispy Veg Spring Rolls', '春卷', 'Snacks', 160, 'Paper-thin wrappers around a julienne of cabbage, carrot and noodles — fried until shatter-crisp.', array['Spring roll sheets', 'Cabbage', 'Carrot', 'Noodles', 'Soy']::text[], 'https://images.pexels.com/photos/37106473/pexels-photo-37106473.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.5, 276, 1, true, false, '10 min', true),
  ('chilli-paneer-dry', 'Chilli Paneer Dry', '辣椒奶酪', 'Snacks', 250, 'Cubes of soft paneer wok-tossed with bell peppers, soy, and green chilli — a vegetarian crowd-pleaser.', array['Paneer', 'Bell pepper', 'Soy', 'Green chilli', 'Garlic']::text[], 'https://images.pexels.com/photos/29631468/pexels-photo-29631468.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.7, 341, 2, true, false, '12 min', true),
  ('honey-chilli-potato', 'Honey Chilli Potato', '蜜辣土豆', 'Snacks', 180, 'Twice-fried potato strips glazed in honey, chilli and sesame. Sticky, sweet, spicy — all at once.', array['Potato', 'Honey', 'Red chilli', 'Sesame seeds', 'Soy']::text[], 'https://images.pexels.com/photos/30709506/pexels-photo-30709506.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=600&w=600', 4.6, 412, 2, true, false, '12 min', true),
  ('jasmine-green-tea', 'Jasmine Green Tea', '茉莉绿茶', 'Drinks', 90, 'Hand-rolled jasmine pearls steeped to release a floral, calming aroma. The traditional accompaniment to dim sum.', array['Jasmine green tea leaves', 'Hot water']::text[], 'https://images.pexels.com/photos/36299339/pexels-photo-36299339.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.6, 156, 0, true, false, '5 min', true),
  ('lychee-iced-cooler', 'Lychee Iced Cooler', '荔枝冰饮', 'Drinks', 140, 'Sweet lychee pulp shaken with lime, mint and crushed ice. A summer favourite.', array['Lychee', 'Lime', 'Mint', 'Sugar syrup', 'Ice']::text[], 'https://images.pexels.com/photos/37659704/pexels-photo-37659704.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600', 4.5, 198, 0, true, false, '5 min', true)
on conflict (slug) do update set
  name = excluded.name,
  chinese_name = excluded.chinese_name,
  category = excluded.category,
  price = excluded.price,
  description = excluded.description,
  ingredients = excluded.ingredients,
  image = excluded.image,
  spicy = excluded.spicy,
  veg = excluded.veg,
  featured = excluded.featured,
  prep_time = excluded.prep_time;

-- ── house reviews ───────────────────────────────────────────────────────

insert into public.reviews (product_id, rating, body, user_name, location, verified)
select p.id, v.rating, v.body, v.user_name, v.location, true
  from public.products p
  join (values
    ('khang-special-veg-momo', 5, 'The momos are the best I have had outside of Kolkata. Steamed perfectly, and that schezwan dip is dangerous.', 'Ananya R.', 'Madurai'),
    ('chicken-dimsum-basket', 5, 'Ordered for a small birthday dinner — everything arrived hot, and the hargao looked hand-pleated. Lovely.', 'Vikram S.', 'Chennai'),
    ('crystal-prawn-hargao', 4, 'Solid dim sum and generous portions. Delivery took a little longer than promised but the food was worth it.', 'Meera K.', 'Madurai'),
    ('chilli-chicken-gravy', 5, 'The chilli chicken gravy with steamed rice is my weekly order now. Proper heat, not just colour.', 'Rahul D.', 'Coimbatore')
  ) as v(slug, rating, body, user_name, location) on false
where p.slug = v.slug
  and not exists (
    select 1 from public.reviews r
     where r.product_id = p.id and r.user_name = v.user_name
  );

-- ── the newsletter list starts empty ────────────────────────────────────
-- (subscribers arrive through subscribe_newsletter())

-- ── make yourself an admin ──────────────────────────────────────────────
-- Sign up in the app first, then run:
--   update public.profiles set role = 'admin' where id = (
--     select id from auth.users where email = 'you@example.com');
