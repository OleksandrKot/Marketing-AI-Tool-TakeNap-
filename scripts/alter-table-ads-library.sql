-- Додавання нових колонок до існуючої таблиці ads_library
-- Виконуйте ці команди, якщо таблиця ads_library вже існує,
-- але не містить цих колонок.

ALTER TABLE ads_library
ADD COLUMN IF NOT EXISTS audio_script TEXT,
ADD COLUMN IF NOT EXISTS video_script TEXT,
ADD COLUMN IF NOT EXISTS meta_ad_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_description TEXT;

-- Оновлення тестових даних для нових колонок
-- Цей блок можна виконати після ALTER TABLE, щоб заповнити нові поля
-- для вже існуючих тестових записів або додати нові записи з повними даними.
-- Якщо ви вже маєте дані, які хочете зберегти, будьте обережні з INSERT.
-- Цей INSERT ON CONFLICT DO NOTHING додасть нові записи, якщо ad_archive_id не існує.
INSERT INTO ads_library (
  ad_archive_id,
  page_name,
  text,
  caption,
  cta_text,
  cta_type,
  display_format,
  link_url,
  title,
  video_hd_url,
  video_preview_image,
  publisher_platform,
  audio_script,
  video_script,
  meta_ad_url,
  image_url,
  image_description
) VALUES
(
  '123456789',
  'BetterMe',
  'How to hit enough protein for weight loss and gain muscle? High Protein Meal Plan for Busy Women on a Weight Loss Journey',
  'Transform your body with our meal plan',
  'Try now!',
  'LEARN_MORE',
  'VIDEO',
  'https://betterme.world',
  'High Protein Meal Plan',
  'https://placeholder.svg?height=400&width=600&query=video-placeholder',
  '/placeholder.svg?height=400&width=600',
  'Facebook',
  'How to hit enough protein for weight loss and gain muscle. In a week, you''ll start to feel it...',
  '00:00 – 00:02: A hand uses a spoon to scoop a spoonful of a fruit-and-yogurt-based meal.',
  'https://www.facebook.com/ads/library/ad_archive/?id=123456789',
  'https://placeholder.svg?height=400&width=600&query=protein-meal-plan-image',
  'Image of a healthy protein-rich meal.'
),
(
  '987654321',
  'Nike',
  'Just Do It. New collection available now.',
  'Nike Air Max - Step into greatness',
  'Shop Now',
  'SHOP_NOW',
  'IMAGE',
  'https://nike.com',
  'Nike Air Max Collection',
  NULL,
  '/placeholder.svg?height=400&width=600',
  'Instagram',
  NULL,
  NULL,
  'https://www.facebook.com/ads/library/ad_archive/?id=987654321',
  'https://placeholder.svg?height=400&width=600&query=nike-air-max-shoes',
  'Close-up of Nike Air Max shoes on a running track.'
),
(
  '456789123',
  'Spotify',
  'Discover new music every day. Premium free for 3 months.',
  'Music for every moment',
  'Get Premium',
  'SIGN_UP',
  'VIDEO',
  'https://spotify.com/premium',
  'Spotify Premium',
  'https://placeholder.svg?height=400&width=600&query=spotify-video',
  '/placeholder.svg?height=400&width=600',
  'Facebook',
  'Discover new music every day. Premium free for 3 months. Get Premium now!',
  '00:00 – 00:03: Animated Spotify logo with music notes floating around.',
  'https://www.facebook.com/ads/library/ad_archive/?id=456789123',
  'https://placeholder.svg?height=400&width=600&query=spotify-app-screenshot',
  'Screenshot of Spotify app interface with music playing.'
)
ON CONFLICT (ad_archive_id) DO NOTHING;
