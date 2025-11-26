-- Adaptive designs table (simplified version of ads_library)
-- This table stores user-created adaptive creatives derived from an existing ad (ads_library).
-- It purposefully excludes external links and keeps fields simpler (textual descriptions, assets stored separately).

CREATE TABLE IF NOT EXISTS adaptive_designs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  --Refetence id
  user_id UUID NOT NULL,
  ad_archive_id_reference TEXT,
  
  title TEXT,
  text TEXT,
  caption TEXT,

  -- Format and Creative Concept fields
  concept TEXT,
  format TEXT,
  realisation TEXT,
  topic TEXT,
  hook TEXT,
  character TEXT,

  --Creative details
  main_obj_and_char, TEXT,
  background_description TEXT,
  style_description TEXT,
  emotions_description TEXT,
  mood_description TEXT,
  image_description TEXT,
  
);

CREATE INDEX IF NOT EXISTS idx_adaptive_designs_user ON adaptive_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_adaptive_designs_based_on_ad ON adaptive_designs(ad_archive_id_reference);
