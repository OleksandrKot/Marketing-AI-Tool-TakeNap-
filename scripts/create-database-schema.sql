-- Створення таблиці ads_library
CREATE TABLE IF NOT EXISTS ads_library (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ad_archive_id TEXT,
  page_name TEXT,
  text TEXT,
  caption TEXT,
  cta_text TEXT,
  cta_type TEXT,
  display_format TEXT,
  link_url TEXT,
  title TEXT,
  video_hd_url TEXT,
  video_preview_image TEXT,
  publisher_platform TEXT
);

-- Додавання індексів для швидкості
CREATE INDEX IF NOT EXISTS idx_ads_library_page_name ON ads_library(page_name);
CREATE INDEX IF NOT EXISTS idx_ads_library_created_at ON ads_library(created_at);
CREATE INDEX IF NOT EXISTS idx_ads_library_display_format ON ads_library(display_format);

-- Додавання тестових даних
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
  publisher_platform
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
  'https://example.com/video.mp4',
  '/placeholder.svg?height=400&width=600',
  'Facebook'
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
  'Instagram'
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
  'https://example.com/spotify-video.mp4',
  '/placeholder.svg?height=400&width=600',
  'Facebook'
);
