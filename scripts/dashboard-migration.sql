CREATE INDEX IF NOT EXISTS idx_ads_library_page_name_created_at 
ON ads_library(page_name, created_at DESC);

-- Індекси для фільтрації по форматах, темах, концепціях
CREATE INDEX IF NOT EXISTS idx_ads_library_display_format 
ON ads_library(display_format);

CREATE INDEX IF NOT EXISTS idx_ads_library_topic 
ON ads_library(topic);

CREATE INDEX IF NOT EXISTS idx_ads_library_concept 
ON ads_library(concept);

-- 2. Materialized View для супер-швидкої аналітики (ОПЦІОНАЛЬНО)
-- ⚠️ Використовувати ТІЛЬКИ при дуже великих датасетах (>100,000 креативів)
-- ⚠️ Потребує періодичного оновлення (REFRESH MATERIALIZED VIEW)
-- ⚠️ Займає додатковий простір на диску

-- ЗАКОМЕНТОВАНО за замовчуванням - розкоментуйте тільки при потребі:
/*
CREATE MATERIALIZED VIEW IF NOT EXISTS competitor_analytics_summary AS
SELECT 
  page_name,
  COUNT(*) as total_creatives,
  COUNT(DISTINCT topic) as unique_topics,
  COUNT(DISTINCT cta_type) as unique_funnels,
  COUNT(DISTINCT hook) as unique_mechanics,
  DATE_TRUNC('week', created_at) as week,
  display_format,
  topic,
  cta_type
FROM ads_library
WHERE page_name IS NOT NULL
GROUP BY page_name, DATE_TRUNC('week', created_at), display_format, topic, cta_type;

-- Індекс на materialized view
CREATE INDEX IF NOT EXISTS idx_competitor_analytics_page_week 
ON competitor_analytics_summary(page_name, week);

-- Для оновлення materialized view (запускати щоденно через cron):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY competitor_analytics_summary;
*/

-- ============================================================================
-- ПІДСУМОК
-- ============================================================================
-- ✅ Дашборд працює БЕЗ запуску цього скрипта
-- ✅ Всі необхідні поля вже є в таблиці ads_library
-- ⚠️ Індекси потрібні тільки при повільній роботі
-- ⚠️ Materialized view - тільки для екстремально великих датасетів

-- Verify existing schema has all required fields
-- Run this query to check:
/*
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'ads_library'
AND column_name IN (
  'page_name', 'created_at', 'display_format', 'cta_type',
  'image_description', 'topic', 'concept', 'hook', 
  'realisation', 'character'
)
ORDER BY column_name;
*/

-- Expected result: All columns should exist
-- If any columns are missing, add them:
/*
ALTER TABLE ads_library ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE ads_library ADD COLUMN IF NOT EXISTS concept TEXT;
ALTER TABLE ads_library ADD COLUMN IF NOT EXISTS hook TEXT;
ALTER TABLE ads_library ADD COLUMN IF NOT EXISTS realisation TEXT;
ALTER TABLE ads_library ADD COLUMN IF NOT EXISTS character TEXT;
*/
